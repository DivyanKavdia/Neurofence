resource "aws_kms_key" "platform" {

  description             = "NeuralFence backend data and secret encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30

}
resource "aws_kms_alias" "platform" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.platform.key_id
}
resource "aws_db_subnet_group" "postgres" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}
resource "aws_db_parameter_group" "postgres" {

  name   = "${local.name}-postgres"
  family = "postgres16"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

}
resource "aws_db_instance" "postgres" {

  identifier                      = local.name
  engine                          = "postgres"
  engine_version                  = "16"
  instance_class                  = var.database_class
  allocated_storage               = var.database_storage_gb
  max_allocated_storage           = var.database_storage_gb * 5
  storage_type                    = "gp3"
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.platform.arn
  db_name                         = "neuralfence"
  username                        = "platform_admin"
  manage_master_user_password     = true
  master_user_secret_kms_key_id   = aws_kms_key.platform.arn
  db_subnet_group_name            = aws_db_subnet_group.postgres.name
  parameter_group_name            = aws_db_parameter_group.postgres.name
  vpc_security_group_ids          = [aws_security_group.data.id]
  publicly_accessible             = false
  multi_az                        = var.database_multi_az
  backup_retention_period         = 14
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${local.name}-final"
  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

}
resource "random_password" "redis" {
  length  = 40
  special = false
}
resource "aws_secretsmanager_secret" "redis" {
  name                    = "${local.name}/redis"
  kms_key_id              = aws_kms_key.platform.arn
  recovery_window_in_days = 30
}
resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({
    password = random_password.redis.result
  })
}
resource "aws_elasticache_subnet_group" "redis" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}
resource "aws_elasticache_replication_group" "redis" {

  replication_group_id       = local.name
  description                = "NeuralFence policy cache, quota counters and reservations"
  engine                     = "valkey"
  engine_version             = "8.0"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 2
  port                       = 6379
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = aws_kms_key.platform.arn
  auth_token                 = random_password.redis.result
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.data.id]
  snapshot_retention_limit   = 7

}
resource "aws_msk_serverless_cluster" "events" {

  count        = var.enable_event_bus ? 1 : 0
  cluster_name = local.name
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.data.id]
  }
  client_authentication {
    sasl {
      iam {
        enabled = true
      }
    }
  }

}
resource "aws_s3_bucket" "evidence" {

  bucket_prefix       = "${local.name}-evidence-"
  object_lock_enabled = true
  force_destroy       = false

}
resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  versioning_configuration {
    status = "Enabled"
  }
}
resource "aws_s3_bucket_object_lock_configuration" "evidence" {

  bucket = aws_s3_bucket.evidence.id
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.evidence_retention_days
    }
  }
  depends_on = [aws_s3_bucket_versioning.evidence]

}
resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {

  bucket = aws_s3_bucket.evidence.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.platform.arn
    }
    bucket_key_enabled = true
  }

}
resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_policy" "evidence" {

  bucket = aws_s3_bucket.evidence.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Sid = "RequireTLS", Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.evidence.arn, "${aws_s3_bucket.evidence.arn}/*"], Condition = {
        Bool = {
          "aws:SecureTransport" = "false"
        }
      }
    }]
  })

}
resource "aws_secretsmanager_secret" "application" {

  for_each                = toset(["postgres-app", "clickhouse", "litellm-executor", "provider-openai", "provider-azure", "provider-anthropic", "provider-bedrock", "provider-gemini", "mcp-upstream", "oidc-client", "siem-webhook"])
  name                    = "${local.name}/${each.key}"
  description             = "Populate through the secure backend bootstrap workflow before deploying a consumer"
  kms_key_id              = aws_kms_key.platform.arn
  recovery_window_in_days = 30

}
resource "random_password" "clickhouse" {
  length  = 40
  special = false
}
resource "aws_secretsmanager_secret_version" "clickhouse" {
  secret_id     = aws_secretsmanager_secret.application["clickhouse"].id
  secret_string = jsonencode({ username = "neuralfence", password = random_password.clickhouse.result, database = "neuralfence" })
}
resource "aws_iam_role" "runtime" {

  name = "${local.name}-runtime"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = {
        Federated = aws_iam_openid_connect_provider.cluster.arn
        }, Action = "sts:AssumeRoleWithWebIdentity", Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.cluster.url, "https://", "")}:sub" = "system:serviceaccount:neuralfence:runtime", "${replace(aws_iam_openid_connect_provider.cluster.url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })

}
resource "aws_iam_role_policy" "runtime" {

  name = "data-dependencies"
  role = aws_iam_role.runtime.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = concat([
      {
        Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = concat([for secret in aws_secretsmanager_secret.application : secret.arn], [aws_secretsmanager_secret.redis.arn])
      },
      {
        Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = [aws_kms_key.platform.arn]
      },
      {
        Effect = "Allow", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.evidence.arn]
      },
      {
        Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = ["${aws_s3_bucket.evidence.arn}/*"]
      }
      ], var.enable_event_bus ? [
      {
        Effect = "Allow", Action = ["kafka-cluster:Connect", "kafka-cluster:DescribeCluster"], Resource = [aws_msk_serverless_cluster.events[0].arn]
      },
      {
        Effect = "Allow", Action = ["kafka-cluster:DescribeTopic", "kafka-cluster:WriteData", "kafka-cluster:ReadData", "kafka-cluster:CreateTopic"], Resource = ["${replace(aws_msk_serverless_cluster.events[0].arn, ":cluster/", ":topic/")}/*"]
      },
      {
        Effect = "Allow", Action = ["kafka-cluster:DescribeGroup", "kafka-cluster:AlterGroup"], Resource = ["${replace(aws_msk_serverless_cluster.events[0].arn, ":cluster/", ":group/")}/*"]
      }
    ] : [])
  })

}

data "aws_msk_bootstrap_brokers" "events" {
  count       = var.enable_event_bus ? 1 : 0
  cluster_arn = aws_msk_serverless_cluster.events[0].arn
}
