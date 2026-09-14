variable "company_secret_slots" {
  description = "Company identifiers mapped to secret slot names. Creates empty encrypted slots and a scoped workload role; supply values through secure bootstrap."
  type        = map(set(string))
  default     = {}
  validation {
    condition = alltrue([
      for company, slots in var.company_secret_slots :
      can(regex("^[a-z][a-z0-9-]{2,47}$", company)) && length(slots) > 0 &&
      alltrue([for slot in slots : can(regex("^[a-z][a-z0-9-]{1,39}$", slot))])
    ])
    error_message = "Use company slugs and nonempty sets of lowercase secret slot names."
  }
}

locals {
  company_slots = merge({}, [for company, slots in var.company_secret_slots : {
    for slot in slots : "${company}/${slot}" => { company = company, slot = slot }
  }]...)
}

resource "aws_secretsmanager_secret" "company" {
  for_each                = local.company_slots
  name                    = "${local.name}/companies/${each.key}"
  description             = "Company-owned ${each.value.slot}; populate outside Terraform"
  kms_key_id              = aws_kms_key.platform.arn
  recovery_window_in_days = 30
  tags                    = { Company = each.value.company }
}

resource "aws_iam_role" "company_runtime" {
  for_each = var.company_secret_slots
  name     = "${substr(local.name, 0, 28)}-co-${substr(each.key, 0, 12)}-${substr(sha256("${local.name}/${each.key}"), 0, 8)}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.cluster.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.cluster.url, "https://", "")}:sub" = "system:serviceaccount:neuralfence:company-${each.key}"
          "${replace(aws_iam_openid_connect_provider.cluster.url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "company_secrets" {
  for_each = var.company_secret_slots
  name     = "company-secret-access"
  role     = aws_iam_role.company_runtime[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [for slot in each.value : aws_secretsmanager_secret.company["${each.key}/${slot}"].arn]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [aws_kms_key.platform.arn]
        Condition = {
          StringEquals = { "kms:ViaService" = "secretsmanager.${var.region}.amazonaws.com" }
          StringLike   = { "kms:EncryptionContext:SecretARN" = [for slot in each.value : aws_secretsmanager_secret.company["${each.key}/${slot}"].arn] }
        }
      }
    ]
  })
}

output "company_secret_arns" {
  description = "Company secret references for application configuration; contains no secret values."
  value       = { for company, slots in var.company_secret_slots : company => { for slot in slots : slot => aws_secretsmanager_secret.company["${company}/${slot}"].arn } }
}
output "company_workload_roles" {
  value = { for company, role in aws_iam_role.company_runtime : company => {
    role_arn        = role.arn
    namespace       = "neuralfence"
    service_account = "company-${company}"
  } }
}
