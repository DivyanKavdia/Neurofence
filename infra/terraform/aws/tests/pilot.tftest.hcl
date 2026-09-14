mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-south-1a", "ap-south-1b", "ap-south-1c"] }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012", arn = "arn:aws:iam::123456789012:role/operator" }
  }
}
mock_provider "random" {}
mock_provider "tls" {}

run "company_secret_boundaries" {
  command = plan
  variables {
    company_secret_slots = {
      acme      = ["oidc-client", "provider-azure"]
      northstar = ["oidc-client"]
    }
  }
  assert {
    condition     = length(aws_secretsmanager_secret.company) == 3 && length(aws_iam_role.company_runtime) == 2
    error_message = "Company provisioning must create distinct secret slots and workload identities."
  }
  assert {
    condition     = aws_secretsmanager_secret.company["acme/oidc-client"].name != aws_secretsmanager_secret.company["northstar/oidc-client"].name
    error_message = "Companies must never share an identity secret slot."
  }
}

variables {
  administrator_role_arn = "arn:aws:iam::123456789012:role/operator"
}

run "private_pilot_dependencies" {
  command = plan
  assert {
    condition     = !aws_db_instance.postgres.publicly_accessible && aws_db_instance.postgres.storage_encrypted
    error_message = "Postgres must remain private and encrypted."
  }
  assert {
    condition     = aws_elasticache_replication_group.redis.transit_encryption_enabled && aws_elasticache_replication_group.redis.automatic_failover_enabled
    error_message = "The quota cache requires TLS and failover."
  }
  assert {
    condition     = aws_eks_cluster.main.vpc_config[0].endpoint_private_access && !aws_eks_cluster.main.vpc_config[0].endpoint_public_access
    error_message = "The pilot cluster endpoint must be private by default."
  }
  assert {
    condition     = aws_s3_bucket.evidence.object_lock_enabled && aws_s3_bucket_public_access_block.evidence.block_public_policy
    error_message = "Evidence storage requires retention and a public-access block."
  }
  assert {
    condition     = length(aws_subnet.private) == 3 && length(aws_nat_gateway.main) == 1 && length(aws_msk_serverless_cluster.events) == 1
    error_message = "The pilot profile needs three private subnets, one NAT and the event bus."
  }
}

run "redundant_network_and_outbox_profile" {
  command = plan
  variables {
    single_nat_gateway = false
    database_multi_az  = true
    enable_event_bus   = false
  }
  assert {
    condition     = length(aws_nat_gateway.main) == 3 && aws_db_instance.postgres.multi_az && length(aws_msk_serverless_cluster.events) == 0
    error_message = "The alternative profile must honor NAT, database and outbox choices."
  }
}
