# Backend dependency provisioning

The frontend works immediately with its mock BFF. These definitions prepare the dependencies for the real services in the Native Gateway v2 engineering baseline. Nothing here has been applied to a cloud account.

## Dependency mapping

| Dependency | Local development | AWS / platform Terraform | Future consumer |
| --- | --- | --- | --- |
| Transactional state and asset graph | PostgreSQL 16 | Private, encrypted RDS PostgreSQL 16, backups, operator-managed master secret | Control API, policies, inventory, ledger, outbox |
| Quotas, reservations and cache | Valkey 8 | TLS/auth-enabled two-node ElastiCache Valkey, automatic failover | AI/MCP gateways, FinOps |
| Durable events | Single-node Apache Kafka | IAM-authenticated MSK Serverless; optional database outbox profile | Telemetry, workers, assurance |
| Analytics | ClickHouse 25.8 | Single-replica ClickHouse StatefulSet with encrypted EBS PVC | Cost/trace analytics |
| Evidence, reports and artifacts | S3-compatible MinIO | Private encrypted S3, versioning and 90-day governance object retention | Evidence, scanners, reports |
| Secrets and encryption | Development Vault | KMS, Secrets Manager, workload IRSA | Providers, MCP auth, database clients |
| Deterministic policy runtime | OPA | Two OPA pods, default-deny bootstrap | Policy service and gateways |
| Telemetry | OTel + Prometheus | Two OTel pods and configurable OTLP export | All services |
| Container hosting | Optional dependency Compose | Private EKS, managed nodes, EBS CSI, VPC CNI network policy, ECR repositories | Future signed backend images |
| Optional LiteLLM execution | Separate pinned fixture Compose | Reserved ECR/secret slot; optional private deployment and isolated namespace | NeuralFence provider adapter |
| Enterprise identity | Supplied issuer | Configurable OIDC issuer and client-secret slot | Future identity/control API |

The dependency boundary is portable. The frontend calls the same BFF interface in SaaS, private-cloud, on-premises and air-gapped previews. AWS Mumbai is the initial Terraform profile; another cloud requires another infrastructure root using the same dependency contract.

## Local services

The browser mock and optional Node HTTP mock do **not** require these services. Start them when implementing a real backend adapter:

```bash
cp infra/local/.env.example infra/local/.env
# Set local passwords and the development Vault token in infra/local/.env.
docker compose --env-file infra/local/.env -f infra/local/compose.yaml up -d
docker compose --env-file infra/local/.env -f infra/local/compose.yaml ps
```

Published ports bind loopback. Container-to-container hostnames are the service names. Kafka clients on the host use `localhost:9092`; clients in Compose use `kafka:19092`. Create an evidence bucket in the local object-store console at `http://localhost:9001`. The Vault profile is ephemeral development mode. Data volumes persist through `docker compose down`; removing volumes deliberately erases local dependency data.

Image tags identify the initial development versions. Mirror reviewed images and pin digests for releases and disconnected installations. Compose syntax has been parsed; container startup has not been verified here because Docker is unavailable.

## Terraform roots and sequence

Use Terraform 1.14.7 and AWS CLI v2. Configure an AWS account, an operator IAM role, and a versioned encrypted S3 state bucket first. State contains generated dependency credentials; use separate state keys and restrict state reader roles. The runtime IAM policy deliberately excludes the RDS master secret.

`terraform/aws` provisions the network and managed dependencies. Its EKS API is private by default, so run platform provisioning from a runner with VPC connectivity. `terraform/platform` installs Kubernetes dependencies only after the AWS root exists. This avoids initializing a Kubernetes provider against a cluster that has not been created.

Prepare and review a plan:

```bash
cp infra/terraform/aws/pilot.tfvars.example infra/terraform/aws/terraform.tfvars
cp infra/terraform/aws/backend.s3.hcl.example /tmp/neuralfence-aws-backend.hcl
# Replace example account, issuer and state-bucket values.
terraform -chdir=infra/terraform/aws init -backend-config=/tmp/neuralfence-aws-backend.hcl
terraform -chdir=infra/terraform/aws plan -out=pilot.tfplan
```

After the account owner has reviewed the plan, `terraform -chdir=infra/terraform/aws apply pilot.tfplan` provisions it. Run the following helper **after** that successful apply to produce platform variables from the actual outputs:

```bash
node scripts/platform-inputs.mjs
cp infra/terraform/platform/backend.s3.hcl.example /tmp/neuralfence-platform-backend.hcl
# Set the encrypted state bucket and separate platform key.
terraform -chdir=infra/terraform/platform init -backend-config=/tmp/neuralfence-platform-backend.hcl
terraform -chdir=infra/terraform/platform plan -out=platform.tfplan
```

Review and apply `platform.tfplan` from the VPC-connected runner. Populate the application database secret with a restricted database role using the operator bootstrap credential. Populate provider, MCP, IdP and SIEM secret references through the enterprise secret-management process. `terraform output backend_dependencies` and `application_secret_refs` provide integration values without printing secret payloads.

## Backend service handoff

Bind future services to service account `runtime` in namespace `neuralfence` to use the workload IAM role. Applications retrieve secret references through the AWS SDK; the root does not deploy an external-secrets operator. Split the shared pilot role into individual service roles when final service API permissions are known. The RDS master credential stays operator-only.

| Setting | Source |
| --- | --- |
| PostgreSQL host/database/TLS mode | `backend_dependencies.postgres_*` |
| PostgreSQL application secret | `application_secret_refs["postgres-app"]` |
| Redis endpoint/TLS/password reference | `backend_dependencies.redis_*` |
| Kafka bootstrap/auth | `backend_dependencies.kafka_*` |
| Evidence bucket/KMS | `backend_dependencies.object_bucket`, `kms_key` |
| ClickHouse HTTP endpoint / secret | `backend_dependencies.clickhouse_url`, `application_secret_refs["clickhouse"]` |
| Policy endpoint | `backend_dependencies.policy_url` |
| OTLP HTTP endpoint | `backend_dependencies.telemetry_url` |
| OIDC issuer / client secret | `backend_dependencies.oidc_issuer`, `application_secret_refs["oidc-client"]` |

The frontend/mock API is not deployed into this cluster. ECR repositories reserve the service boundaries; migrations, real authorization, signed bundles, provider connectors and service images are the next backend implementation. Add ingress/TLS/domain configuration when deploying the control API and console. No real provider secret belongs in `config.js` or the browser bundle.

The [LiteLLM integration guide](../integrations/litellm/README.md) documents its optional deployment. `enable_litellm` defaults to false; enabling it requires reviewed YAML and a populated `litellm-executor` secret. The deployment uses a dedicated namespace and admits only labeled gateway/control-api clients. A real enabled plan and cluster startup validation remain required.

## Profiles and validation limits

The pilot defaults to one NAT gateway, a single-AZ database and one ClickHouse replica. Set `single_nat_gateway=false` and `database_multi_az=true` for network/database redundancy. ClickHouse replication, worker autoscaling, production monitoring destinations and per-service egress restrictions remain deployment decisions. EKS node min/max values alone do not install a cluster autoscaler. HTTPS egress is allowed for provider/secret endpoints; restrict it through the chosen egress proxy for production. Network policy starts in VPC CNI standard mode; strict startup enforcement requires cluster-wide DNS/system policies as well.

GitHub CI passes HCL formatting, locked-provider initialization and provider validation for both roots. Both credential-free AWS mock plans pass: the private pilot dependencies and the redundant-network/outbox profile. See the [validation record](../docs/VALIDATION.md) for evidence. Review an account-specific plan before provisioning. No Terraform apply or cloud smoke test has been run.

```bash
terraform fmt -check -recursive infra/terraform
terraform -chdir=infra/terraform/aws init -backend=false
terraform -chdir=infra/terraform/aws validate
terraform -chdir=infra/terraform/aws test
terraform -chdir=infra/terraform/platform init -backend=false
terraform -chdir=infra/terraform/platform validate
```

The AWS test file uses mock providers and `command = plan`; it does not provision resources. Platform validation checks the provider schema; a real platform plan requires the existing cluster.

References: [Terraform validation](https://developer.hashicorp.com/terraform/cli/commands/validate), [mock provider tests](https://developer.hashicorp.com/terraform/language/tests/mocking), [EKS network policy configuration](https://docs.aws.amazon.com/eks/latest/userguide/cni-network-policy-configure.html).
