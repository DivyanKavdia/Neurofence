# Company administration

Neurofence uses one console and workflow engine for every company. Company identity, memberships, teams and published defaults are shared across environments. Application resources and activity remain isolated by company and environment.

## Try the complete flow

1. Open the demo. **Company admin** is the initial role for Acme Financial. Open **Company administration** to manage the existing company.
2. To create another company, select **Neurofence operator** in **Preview as**, then **Onboard company**. Enter its identifier, first admin, environments and entitlements. Creation switches to that first admin's demo identity.
3. In **People & teams**, invite another member with **Security admin** or **Company admin**. Open **Manage**, choose **Active**, and record a reason. This activation simulates accepting an invitation; no email is sent.
4. Complete company onboarding. Optionally use **Create demo application** in an empty environment to add dummy providers, published policies, routes, budgets and applications.
5. Edit **Configuration**. Save a draft, validate it and request review. Switch to the independent security administrator, approve with a reason, switch back to Company admin and publish. Draft values never replace running values.
6. Use **Effective configuration** to select an application and inspect its resolved values and their source. **History & audit** can restore an earlier version into a new reviewed draft.

The profile dialog selects registered companies and active member identities. Reloading preserves the selected demo session. A failed/suspended session offers an explicit return to the original demo or the operator preview.

## Configuration ownership

| Owner                  | Responsibility                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Neurofence operator    | Create companies, assign entitlements, suspend/restore companies, review provisioning requests                |
| Company admin          | Company configuration, environments, memberships, teams, provider connections and delegated role permissions  |
| Security admin         | Security policies, detectors and independent company configuration review                                     |
| Other specialist roles | Existing Platform engineer, Governance owner, FinOps owner, SOC, Developer, Agent owner and Auditor workflows |

Operator authority never grants application-data access. Company admins assign company roles; they cannot assign operator authority. Role templates can be narrowed through a reviewed configuration draft. Backend-derived capabilities drive both interface controls and mutation enforcement. Suspending membership or removing a permission also blocks replaying a protected request receipt. Keep at least one active company admin.

The company-wide member registry replaces environment-local member CRUD. Existing Acme and Northstar workspaces migrate once, preserving their resources and existing extra members. Unknown tenant names fail instead of silently creating workspaces. Team membership extends a Developer/Agent owner's application scope to assigned team applications.

## Inheritance and runtime behavior

Precedence is **company → assigned team → environment → application**. An application override names both its environment and application ID. Company locks always retain the company value; conflicting overrides fail validation. Overrides cannot enable modules the company has disabled, and company modules must fit operator entitlements. Gateway requires Guardrails and FinOps; Agents also requires Gateway; assurance modules require Inventory.

| Configuration                                                             | Effect in this implementation                                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Name, uploaded logo, brand color, timezone, density, landing page         | Console identity, accessible button contrast, timestamps and default presentation                                      |
| Approved domains                                                          | Restricts new or changed member email addresses; existing members are retained                                         |
| Enabled modules                                                           | Navigation, workspace reads, collection API access and scoped runtime availability                                     |
| Provider/model allowlists                                                 | Runtime eligible model connections; a model allowlist checks the connection's actual model binding                     |
| Mandatory PII/injection, residency, token limit                           | Supplements application policies; required unavailable detectors fail closed                                           |
| Tool action classes                                                       | Blocks excluded tool actions before invocation or charge                                                               |
| Application request/monthly budget ceilings                               | Per application, per environment; UTC calendar month; existing budget hierarchy also applies                           |
| Privacy and retention                                                     | Per-application retention and raw-content eligibility; legal holds preserve already retained evidence                  |
| Notification event selection                                              | Filters the action queue's approvals/incidents/budget alerts; destination delivery is still a production integration   |
| IdP issuer, client ID, secret reference, group mappings, session duration | Validated connection configuration and verified-identity adapter contract; live SSO/SCIM is not enabled by these forms |

Company changes always need independent review, including rollback. Changes to published configuration invalidate policy-distribution bundles and bind new model/tool decisions and budget/tool approvals to the company version. Domain-specific policies, detector dictionaries, agent grants, price versions, integrations, budgets and assurance schedules continue to use their existing feature screens and resource lifecycles.

Company settings use company versions for optimistic concurrency. Legacy **Governance → Settings** now contains only deployment/health demo scenarios and environment reset. Reset leaves company membership and published configuration intact.

## Code and API map

| Location                                 | What to change                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/contracts/src/company.ts`      | Typed company records, default values, override keys and deterministic resolver           |
| `packages/demo-backend/src/company/`     | Registry migration, validation, admin actions, role checks and runtime constraints        |
| `apps/console/src/features/company/`     | Onboarding, members/teams, configuration, identity, audit and provisioning screens        |
| `packages/contracts/src/identity.ts`     | Mapping an already verified identity through a persisted company membership               |
| `infra/database/001_company_control.sql` | PostgreSQL tables, tenant policies, relational boundaries and immutable published history |
| `infra/terraform/aws/companies.tf`       | Optional encrypted company secret slots and scoped workload identities                    |

All endpoints use `/api/v1`. Every mutation requires an idempotency key; all company actions except company creation also require **the current company version**, including member and team edits.

| Endpoint                                                   | Operations                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/companies`                                               | Operator GET list; POST onboarding                                                        |
| `/companies/{id}/status`, `/entitlements`, `/provisioning` | Operator POST status, entitlement or provisioning review                                  |
| `/company`                                                 | GET current company's administration data for authorized admin/review/audit roles         |
| `/company/effective?project={id}`                          | GET published effective configuration, scoped to accessible applications                  |
| `/company/config/{action}`                                 | POST `draft`, `validate`, `submit`, `approve`, `reject`, `publish`, `discard`, `rollback` |
| `/company/members`, `/company/members/{id}`                | POST invitation; PATCH name/email/roles/teams/status with a reason                        |
| `/company/teams`, `/company/teams/{id}`                    | POST/PATCH teams; DELETE only when no assignment/override references remain               |
| `/company/project-teams`, `/company/environments`          | POST application/team assignment or add an environment                                    |
| `/company/starter`, `/company/activate`                    | POST dummy starter resources or complete onboarding                                       |
| `/company/provisioning`                                    | POST request infrastructure/identity/notification work                                    |

## Production connection

The browser and HTTP implementations remain **dummy backends**. Demo identities and operator preview are explicitly selectable. Company records persist separately from environment records; HTTP uses flushed atomic file replacement. Company receipts are durable but bounded to 100 entries and approximately 750 KB (the newest receipt is retained). This remains one serialized backend instance; multiple processes or browser tabs need transactional concurrency before production use.

`sessionForVerifiedIdentity` accepts an identity that an OIDC/SAML verifier has already authenticated. It checks issuer binding, company membership, active status, selected role/environment, token expiry and company session duration. It never verifies a token itself. The HTTP demo refuses `NODE_ENV=production` or a non-demo `NF_AUTH_MODE`; a real adapter must remove demo headers and role preview, verify tokens/session cookies and CSRF, and supply authenticated capabilities.

Apply the database schema with a migration owner. Tenant requests need a non-owner, non-superuser role without `BYPASSRLS`. After identity and membership validation, set the transaction-local tenant UUID. Commit company updates, audit, idempotency receipts and the outbox event together. The schema is a production handoff, not the storage adapter currently used by the demo; add the domain-resource schemas and tenant-bound application/team foreign keys when replacing the file store.

Terraform provisions dependencies. Runtime company settings are API/database records. Populate company secrets through a secure bootstrap process, bind the returned workload role to its exact service account, and distribute signed configuration bundles. The new company roles can read only their own configured secret slots; they are not automatically attached to workloads. Region migrations and dedicated deployments require operator work, infrastructure planning and data migration. **Ready for provisioning** records a review outcome; it does not create cloud resources.

The tests cover company isolation, permission revocation, independent review, inheritance, runtime enforcement, rollback, persistence, HTTP scope encoding and mobile/browser flows. PostgreSQL CI tests additionally exercise row isolation, cross-company foreign keys, independent review constraints and immutable history.
