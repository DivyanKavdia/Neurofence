variable "name" {

  type    = string
  default = "neuralfence"
  validation {

    condition     = can(regex("^[a-z][a-z0-9-]{2,24}$", var.name))
    error_message = "Use 3–25 lowercase letters, digits or hyphens."

  }

}
variable "environment" {
  type    = string
  default = "pilot"
}
variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "vpc_cidr" {
  type    = string
  default = "10.60.0.0/16"
}
variable "kubernetes_version" {

  type        = string
  default     = "1.34"
  description = "Review EKS standard-support availability in your region before applying."

}
variable "administrator_role_arn" {

  type        = string
  description = "Existing IAM role used by operators and the platform Terraform runner."
  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:role/.+$", var.administrator_role_arn))
    error_message = "Supply an existing IAM role ARN."
  }

}
variable "public_cluster_endpoint" {
  type    = bool
  default = false
}
variable "administrator_cidrs" {

  type    = list(string)
  default = []
  validation {
    condition     = alltrue([for cidr in var.administrator_cidrs : can(cidrhost(cidr, 0)) && cidr != "0.0.0.0/0"])
    error_message = "Use specific administrator CIDRs, never the whole internet."
  }

}
variable "single_nat_gateway" {
  type        = bool
  default     = true
  description = "Pilot cost profile. Set false for one NAT gateway in each availability zone."
}
variable "node_instance_types" {
  type    = list(string)
  default = ["m7i.large"]
}
variable "node_min" {
  type    = number
  default = 2
}
variable "node_desired" {
  type    = number
  default = 2
}
variable "node_max" {
  type    = number
  default = 6
}
variable "database_class" {
  type    = string
  default = "db.t4g.medium"
}
variable "database_multi_az" {
  type    = bool
  default = false
}
variable "database_storage_gb" {
  type    = number
  default = 100
}
variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}
variable "enable_event_bus" {
  type    = bool
  default = true
}
variable "evidence_retention_days" {
  type    = number
  default = 90
}
variable "deletion_protection" {
  type    = bool
  default = true
}
variable "oidc_provider_url" {
  type        = string
  default     = ""
  description = "Enterprise issuer URL supplied to the future control API; Terraform does not create a user directory."
}
