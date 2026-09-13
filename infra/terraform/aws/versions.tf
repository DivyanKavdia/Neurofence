terraform {

  required_version = ">= 1.7, < 2.0"
  required_providers {

    aws = {
      source = "hashicorp/aws", version = "~> 6.42"
    }
    random = {
      source = "hashicorp/random", version = "~> 3.7"
    }
    tls = {
      source = "hashicorp/tls", version = "~> 4.1"
    }

  }
  # Configure an encrypted, versioned remote backend before applying.
  # See backend.s3.hcl.example. No cloud resources are created by validation.
  backend "s3" {

  }

}
provider "aws" {

  region = var.region
  default_tags {
    tags = {
      Project = "NeuralFence", Environment = var.environment, ManagedBy = "Terraform"
    }
  }

}
data "aws_caller_identity" "current" {

}
data "aws_availability_zones" "available" {
  state = "available"
}
locals {

  name     = "${var.name}-${var.environment}"
  azs      = slice(data.aws_availability_zones.available.names, 0, 3)
  services = toset(["control-api", "ai-gateway", "litellm", "mcp-gateway", "guardrails", "policy", "finops", "telemetry", "evidence", "worker", "redteam", "scanner", "web-console"])

}
