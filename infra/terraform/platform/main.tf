data "aws_secretsmanager_secret_version" "clickhouse" {
  secret_id = var.clickhouse_secret_arn
}
locals {

  namespace  = "neuralfence"
  clickhouse = jsondecode(data.aws_secretsmanager_secret_version.clickhouse.secret_string)

}
resource "kubernetes_namespace_v1" "platform" {

  metadata {
    name = local.namespace
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted", "app.kubernetes.io/part-of" = "neuralfence"
    }
  }

}
resource "kubernetes_service_account_v1" "runtime" {

  metadata {
    name      = "runtime"
    namespace = kubernetes_namespace_v1.platform.metadata[0].name
    annotations = {
      "eks.amazonaws.com/role-arn" = var.runtime_role_arn
    }
  }
  automount_service_account_token = false

}
resource "kubernetes_secret_v1" "clickhouse" {

  metadata {
    name      = "clickhouse-credentials"
    namespace = local.namespace
  }
  data = {
    username = local.clickhouse.username, password = local.clickhouse.password, database = local.clickhouse.database
  }
  depends_on = [kubernetes_namespace_v1.platform]

}
resource "kubernetes_storage_class_v1" "encrypted" {

  metadata {
    name = "neuralfence-gp3"
  }
  storage_provisioner = "ebs.csi.aws.com"
  parameters = {
    type = "gp3", encrypted = "true"
  }
  reclaim_policy         = "Retain"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true

}
resource "kubernetes_manifest" "clickhouse" {

  manifest = {

    apiVersion = "apps/v1", kind = "StatefulSet"
    metadata = {
      name = "clickhouse", namespace = local.namespace
    }
    spec = {

      serviceName = "clickhouse", replicas = 1, selector = {
        matchLabels = {
          app = "clickhouse"
        }
      }
      template = {

        metadata = {
          labels = {
            app = "clickhouse"
          }
        }
        spec = {

          automountServiceAccountToken = false
          securityContext = {
            runAsNonRoot = true, runAsUser = 101, runAsGroup = 101, fsGroup = 101, seccompProfile = {
              type = "RuntimeDefault"
            }
          }
          containers = [{

            name = "clickhouse", image = var.images["clickhouse"]
            securityContext = {
              allowPrivilegeEscalation = false, capabilities = {
                drop = ["ALL"]
              }
            }
            ports = [{
              name = "http", containerPort = 8123
              }, {
              name = "native", containerPort = 9000
            }]
            env = [{
              name = "CLICKHOUSE_USER", valueFrom = {
                secretKeyRef = {
                  name = "clickhouse-credentials", key = "username"
                }
              }
              }, {
              name = "CLICKHOUSE_PASSWORD", valueFrom = {
                secretKeyRef = {
                  name = "clickhouse-credentials", key = "password"
                }
              }
              }, {
              name = "CLICKHOUSE_DB", valueFrom = {
                secretKeyRef = {
                  name = "clickhouse-credentials", key = "database"
                }
              }
              }, {
              name = "CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT", value = "1"
            }]
            resources = {
              requests = {
                cpu = "500m", memory = "1Gi"
                }, limits = {
                cpu = "2", memory = "4Gi"
              }
            }
            volumeMounts = [{
              name = "data", mountPath = "/var/lib/clickhouse"
              }, {
              name = "logs", mountPath = "/var/log/clickhouse-server"
            }]
            readinessProbe = {
              httpGet = {
                path                 = "/ping", port = 8123
              }, initialDelaySeconds = 15, periodSeconds = 10
            }
            livenessProbe = {
              httpGet = {
                path                 = "/ping", port = 8123
              }, initialDelaySeconds = 60, periodSeconds = 20
            }

          }]
          volumes = [{
            name = "logs", emptyDir = {

            }
          }]

        }

      }
      volumeClaimTemplates = [{
        metadata = {
          name = "data"
          }, spec = {
          accessModes = ["ReadWriteOnce"], storageClassName = kubernetes_storage_class_v1.encrypted.metadata[0].name, resources = {
            requests = {
              storage = var.clickhouse_storage
            }
          }
        }
      }]

    }

  }
  depends_on = [kubernetes_secret_v1.clickhouse]

}
resource "kubernetes_config_map_v1" "policy" {

  metadata {
    name      = "policy-bootstrap"
    namespace = local.namespace
  }
  data = {

    "bootstrap.rego" = "package neuralfence\nimport rego.v1\ndefault allow := false\n# Replace with verified signed bundles from the policy service.\n"

  }
  depends_on = [kubernetes_namespace_v1.platform]

}
resource "kubernetes_config_map_v1" "otel" {

  metadata {
    name      = "otel-config"
    namespace = local.namespace
  }
  data = {

    "config.yaml" = yamlencode({

      receivers = {
        otlp = {
          protocols = {
            grpc = {
              endpoint = "0.0.0.0:4317"
              }, http = {
              endpoint = "0.0.0.0:4318"
            }
          }
        }
      }
      processors = {
        memory_limiter = {
          check_interval = "1s", limit_mib = 384
          }, batch = {
          timeout = "5s"
          }, attributes = {
          actions = [{
            key = "gen_ai.prompt", action = "delete"
            }, {
            key = "gen_ai.completion", action = "delete"
            }, {
            key = "http.request.header.authorization", action = "delete"
          }]
        }
      }
      exporters = merge(
        var.otlp_export_endpoint == "" ? { debug = { verbosity = "basic" } } : {},
        var.otlp_export_endpoint != "" ? { otlphttp = { endpoint = var.otlp_export_endpoint } } : {}
      )
      extensions = {
        health_check = {
          endpoint = "0.0.0.0:13133"
        }
      }
      service = {
        extensions = ["health_check"], pipelines = {
          for signal in ["traces", "metrics", "logs"] : signal => {
            receivers = ["otlp"], processors = signal == "metrics" ? ["memory_limiter", "batch"] : ["memory_limiter", "attributes", "batch"], exporters = [var.otlp_export_endpoint == "" ? "debug" : "otlphttp"]
          }
        }
      }

    })

  }
  depends_on = [kubernetes_namespace_v1.platform]

}
resource "kubernetes_manifest" "services" {

  for_each = {
    clickhouse = {
      port = 8123, target = 8123
      }, policy = {
      port = 8181, target = 8181
      }, otel = {
      port = 4318, target = 4318
    }
  }
  manifest = {
    apiVersion = "v1", kind = "Service", metadata = {
      name = each.key, namespace = local.namespace
      }, spec = {
      type = "ClusterIP", selector = {
        app = each.key
        }, ports = [{
          name = "http", port = each.value.port, targetPort = each.value.target
      }]
    }
  }
  depends_on = [kubernetes_namespace_v1.platform]

}
resource "kubernetes_manifest" "stateless" {

  for_each = {

    policy = {
      port = 8181, health = "/health", config = "policy-bootstrap", mount = "/policies", args = ["run", "--server", "--addr=0.0.0.0:8181", "/policies"]
    }
    otel = {
      port = 13133, health = "/", config = "otel-config", mount = "/etc/otel", args = ["--config=/etc/otel/config.yaml"]
    }

  }
  manifest = {

    apiVersion = "apps/v1", kind = "Deployment", metadata = {
      name = each.key, namespace = local.namespace
    }
    spec = {
      replicas = 2, selector = {
        matchLabels = {
          app = each.key
        }
        }, template = {
        metadata = {
          labels = {
            app = each.key
          }
          }, spec = {

          automountServiceAccountToken = false
          securityContext = {
            runAsNonRoot = true, runAsUser = 10001, runAsGroup = 10001, seccompProfile = {
              type = "RuntimeDefault"
            }
          }
          containers = [{
            name = each.key, image = var.images[each.key], args = each.value.args, securityContext = {
              allowPrivilegeEscalation = false, readOnlyRootFilesystem = true, capabilities = {
                drop = ["ALL"]
              }
              }, resources = {
              requests = {
                cpu = "100m", memory = "128Mi"
                }, limits = {
                cpu = "1", memory = "512Mi"
              }
              }, volumeMounts = [{
                name = "config", mountPath = each.value.mount, readOnly = true
              }], readinessProbe = {
              httpGet = {
                path                 = each.value.health, port = each.value.port
              }, initialDelaySeconds = 5
              }, livenessProbe = {
              httpGet = {
                path                 = each.value.health, port = each.value.port
              }, initialDelaySeconds = 20
            }
          }]
          volumes = [{
            name = "config", configMap = {
              name = each.value.config
            }
          }]

        }
      }
    }

  }
  depends_on = [kubernetes_config_map_v1.policy, kubernetes_config_map_v1.otel]

}
resource "kubernetes_manifest" "network_policy" {

  manifest = {
    apiVersion = "networking.k8s.io/v1", kind = "NetworkPolicy", metadata = {
      name = "platform-dependencies", namespace = local.namespace
      }, spec = {
      podSelector = {

        }, policyTypes = ["Ingress", "Egress"], ingress = [{
          from = [{
            podSelector = {

            }
          }]
          }], egress = [{
          to = [{
            podSelector = {

            }
          }]
          }, {
          to = [{
            namespaceSelector = {
              matchLabels = {
                "kubernetes.io/metadata.name" = "kube-system"
              }
            }
            }], ports = [{
            protocol = "UDP", port = 53
            }, {
            protocol = "TCP", port = 53
          }]
          }, {
          to = [{
            ipBlock = {
              cidr = var.vpc_cidr
            }
            }], ports = [{
            protocol = "TCP", port = 5432
            }, {
            protocol = "TCP", port = 6379
            }, {
            protocol = "TCP", port = 9098
          }]
          }, {
          ports = [{
            protocol = "TCP", port = 443
          }]
      }]
    }
  }
  depends_on = [kubernetes_namespace_v1.platform]

}
output "dependency_endpoints" {

  value = {
    clickhouse = "http://clickhouse.${local.namespace}.svc.cluster.local:8123", policy = "http://policy.${local.namespace}.svc.cluster.local:8181", otel = "http://otel.${local.namespace}.svc.cluster.local:4318", runtime_service_account = "runtime", namespace = local.namespace
  }

}
