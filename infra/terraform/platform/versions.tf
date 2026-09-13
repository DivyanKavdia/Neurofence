terraform {

  required_version = ">= 1.7, < 2.0"
  required_providers {

    aws = {
      source = "hashicorp/aws", version = "~> 6.42"
    }
    kubernetes = {
      source = "hashicorp/kubernetes", version = "~> 2.38"
    }

  }
  backend "s3" {

  }

}
provider "aws" {
  region = var.region
}
data "aws_eks_cluster" "main" {
  name = var.cluster_name
}
provider "kubernetes" {

  host                   = data.aws_eks_cluster.main.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.main.certificate_authority[0].data)
  exec {

    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", var.cluster_name, "--region", var.region]

  }

}
variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "cluster_name" {
  type = string
}
variable "runtime_role_arn" {
  type = string
}
variable "clickhouse_secret_arn" {
  type        = string
  description = "Secrets Manager JSON containing username, password and database."
}
variable "images" {

  type = map(string)
  default = {

    clickhouse = "clickhouse/clickhouse-server:25.8"
    policy     = "openpolicyagent/opa:1.8.0-static"
    otel       = "otel/opentelemetry-collector-contrib:0.135.0"

  }
  description = "Versioned dependency images. Resolve to reviewed digests for a release or private registry."

}
variable "clickhouse_storage" {
  type    = string
  default = "100Gi"
}
variable "otlp_export_endpoint" {
  type        = string
  default     = ""
  description = "Optional external OTLP endpoint. Empty keeps metadata in collector logs for a pilot."
}
variable "vpc_cidr" {
  type    = string
  default = "10.60.0.0/16"
}
