output "cluster_name" {
  value = aws_eks_cluster.main.name
}
output "cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}
output "region" {
  value = var.region
}
output "vpc_id" {
  value = aws_vpc.main.id
}
output "vpc_cidr" {
  value = var.vpc_cidr
}
output "runtime_role_arn" {
  value = aws_iam_role.runtime.arn
}
output "evidence_bucket" {
  value = aws_s3_bucket.evidence.id
}
output "repositories" {
  value = {
    for key, repo in aws_ecr_repository.services : key => repo.repository_url
  }
}
output "backend_dependencies" {

  value = {

    postgres_host           = aws_db_instance.postgres.address
    postgres_database       = aws_db_instance.postgres.db_name
    postgres_secret_ref     = aws_secretsmanager_secret.application["postgres-app"].arn
    postgres_sslmode        = "verify-full"
    redis_host              = aws_elasticache_replication_group.redis.primary_endpoint_address
    redis_tls               = true
    redis_secret_ref        = aws_secretsmanager_secret.redis.arn
    kafka_bootstrap_servers = var.enable_event_bus ? data.aws_msk_bootstrap_brokers.events[0].bootstrap_brokers_sasl_iam : ""
    kafka_auth              = var.enable_event_bus ? "SASL_SSL/AWS_MSK_IAM" : "DB outbox profile"
    object_bucket           = aws_s3_bucket.evidence.id
    kms_key                 = aws_kms_key.platform.arn
    oidc_issuer             = var.oidc_provider_url
    clickhouse_url          = "http://clickhouse.neuralfence.svc.cluster.local:8123"
    telemetry_url           = "http://otel.neuralfence.svc.cluster.local:4318"
    policy_url              = "http://policy.neuralfence.svc.cluster.local:8181"

  }

}
output "application_secret_refs" {
  value = {
    for key, secret in aws_secretsmanager_secret.application : key => secret.arn
  }
}
output "database_bootstrap_secret_ref" {

  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
  description = "Operator-only administrator secret. Runtime IAM does not grant access."

}
