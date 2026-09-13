variable "enable_litellm" {
  type        = bool
  default     = false
  description = "Provision the optional private LiteLLM execution service."
}
variable "litellm_image" {
  type        = string
  default     = ""
  description = "Image built from Neurofence's integrated LiteLLM source, pinned by its published digest."
  validation {
    condition     = var.litellm_image == "" || can(regex("@sha256:[a-f0-9]{64}$", var.litellm_image))
    error_message = "Pin the LiteLLM image by SHA-256 digest."
  }
}
variable "litellm_secret_arn" {
  type        = string
  default     = ""
  description = "Populated Secrets Manager JSON with LITELLM_MASTER_KEY and provider environment values."
}
variable "litellm_config_yaml" {
  type        = string
  default     = ""
  description = "Reviewed model configuration; reference secrets as os.environ/NAME, never literal credentials."
}
locals {
  litellm_namespace = "neuralfence-litellm"
  litellm_config    = var.litellm_config_yaml != "" ? var.litellm_config_yaml : file("${path.module}/../../../integrations/litellm/fixture.yaml")
}
data "aws_secretsmanager_secret_version" "litellm" {
  count     = var.enable_litellm ? 1 : 0
  secret_id = var.litellm_secret_arn
}
resource "kubernetes_namespace_v1" "litellm" {
  count = var.enable_litellm ? 1 : 0
  metadata {
    name = local.litellm_namespace
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted"
      "app.kubernetes.io/part-of"          = "neuralfence"
    }
  }
}
resource "kubernetes_secret_v1" "litellm" {
  count = var.enable_litellm ? 1 : 0
  metadata {
    name      = "executor-credentials"
    namespace = kubernetes_namespace_v1.litellm[0].metadata[0].name
  }
  data = { for key, value in jsondecode(data.aws_secretsmanager_secret_version.litellm[0].secret_string) : key => tostring(value) }
  lifecycle {
    precondition {
      condition     = can(jsondecode(data.aws_secretsmanager_secret_version.litellm[0].secret_string).LITELLM_MASTER_KEY)
      error_message = "Populate the executor secret with LITELLM_MASTER_KEY before enabling LiteLLM."
    }
  }
}
resource "kubernetes_config_map_v1" "litellm" {
  count = var.enable_litellm ? 1 : 0
  metadata {
    name      = "executor-config"
    namespace = kubernetes_namespace_v1.litellm[0].metadata[0].name
  }
  data = { "config.yaml" = local.litellm_config }
  lifecycle {
    precondition {
      condition     = var.litellm_config_yaml != "" && try(yamldecode(local.litellm_config).general_settings.master_key == "os.environ/LITELLM_MASTER_KEY", false)
      error_message = "Provide reviewed LiteLLM YAML with the master key read from its environment."
    }
    precondition {
      condition     = try(yamldecode(local.litellm_config).router_settings.num_retries == 0, false) && try(yamldecode(local.litellm_config).litellm_settings.num_retries == 0, false)
      error_message = "Disable automatic retries; NeuralFence owns the execution receipt and reconciliation."
    }
  }
}
resource "kubernetes_manifest" "litellm_deployment" {
  count = var.enable_litellm ? 1 : 0
  lifecycle {
    precondition {
      condition     = var.litellm_image != ""
      error_message = "Build and publish the integrated backend, then provide its image digest before enabling LiteLLM."
    }
  }
  manifest = {
    apiVersion = "apps/v1", kind = "Deployment"
    metadata   = { name = "litellm", namespace = local.litellm_namespace }
    spec = {
      replicas = 2
      selector = { matchLabels = { app = "litellm" } }
      template = {
        metadata = { labels = { app = "litellm" }, annotations = { "neuralfence/config-sha" = sha256(local.litellm_config) } }
        spec = {
          automountServiceAccountToken = false
          securityContext              = { runAsNonRoot = true, runAsUser = 1000, runAsGroup = 1000, fsGroup = 1000, seccompProfile = { type = "RuntimeDefault" } }
          containers = [{
            name            = "litellm", image = var.litellm_image
            args            = ["--config", "/etc/neuralfence/config.yaml", "--host", "0.0.0.0", "--port", "4000"]
            ports           = [{ name = "http", containerPort = 4000 }]
            envFrom         = [{ secretRef = { name = "executor-credentials" } }]
            env             = [{ name = "LITELLM_LOCAL_MODEL_COST_MAP", value = "True" }, { name = "TIKTOKEN_CACHE_DIR", value = "/tmp/tiktoken" }, { name = "XDG_CACHE_HOME", value = "/tmp/cache" }]
            securityContext = { allowPrivilegeEscalation = false, readOnlyRootFilesystem = true, capabilities = { drop = ["ALL"] } }
            resources       = { requests = { cpu = "250m", memory = "512Mi" }, limits = { cpu = "2", memory = "2Gi" } }
            readinessProbe  = { httpGet = { path = "/health/liveliness", port = 4000 }, initialDelaySeconds = 15, periodSeconds = 10 }
            livenessProbe   = { httpGet = { path = "/health/liveliness", port = 4000 }, initialDelaySeconds = 60, periodSeconds = 20 }
            volumeMounts    = [{ name = "config", mountPath = "/etc/neuralfence", readOnly = true }, { name = "tmp", mountPath = "/tmp" }]
          }]
          volumes = [{ name = "config", configMap = { name = "executor-config" } }, { name = "tmp", emptyDir = {} }]
        }
      }
    }
  }
  depends_on = [kubernetes_config_map_v1.litellm, kubernetes_secret_v1.litellm]
}
resource "kubernetes_manifest" "litellm_service" {
  count = var.enable_litellm ? 1 : 0
  manifest = {
    apiVersion = "v1", kind = "Service"
    metadata   = { name = "litellm", namespace = local.litellm_namespace }
    spec       = { type = "ClusterIP", selector = { app = "litellm" }, ports = [{ name = "http", port = 4000, targetPort = 4000 }] }
  }
  depends_on = [kubernetes_namespace_v1.litellm]
}
resource "kubernetes_manifest" "litellm_network" {
  count = var.enable_litellm ? 1 : 0
  manifest = {
    apiVersion = "networking.k8s.io/v1", kind = "NetworkPolicy"
    metadata   = { name = "litellm-isolation", namespace = local.litellm_namespace }
    spec = {
      podSelector = {}, policyTypes = ["Ingress", "Egress"]
      ingress = [{
        from = [{
          namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = local.namespace } }
          podSelector       = { matchExpressions = [{ key = "app", operator = "In", values = ["ai-gateway", "control-api"] }] }
        }]
        ports = [{ protocol = "TCP", port = 4000 }]
      }]
      egress = [
        { to = [{ namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = "kube-system" } } }], ports = [{ protocol = "UDP", port = 53 }, { protocol = "TCP", port = 53 }] },
        { ports = [{ protocol = "TCP", port = 443 }] }
      ]
    }
  }
  depends_on = [kubernetes_namespace_v1.litellm]
}
resource "kubernetes_manifest" "litellm_client_network" {
  count = var.enable_litellm ? 1 : 0
  manifest = {
    apiVersion = "networking.k8s.io/v1", kind = "NetworkPolicy"
    metadata   = { name = "litellm-client-egress", namespace = local.namespace }
    spec = {
      podSelector = { matchExpressions = [{ key = "app", operator = "In", values = ["ai-gateway", "control-api"] }] }
      policyTypes = ["Egress"]
      egress = [{
        to    = [{ namespaceSelector = { matchLabels = { "kubernetes.io/metadata.name" = local.litellm_namespace } }, podSelector = { matchLabels = { app = "litellm" } } }]
        ports = [{ protocol = "TCP", port = 4000 }]
      }]
    }
  }
  depends_on = [kubernetes_namespace_v1.platform]
}
output "litellm_endpoint" {
  value = var.enable_litellm ? "http://litellm.${local.litellm_namespace}.svc.cluster.local:4000" : null
}
