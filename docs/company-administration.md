# Company administration

Company identity, memberships, teams and published defaults are shared across environments. Applications and activity are scoped to a company and environment.

## Try the flow

1. Open **Company administration** as Company admin for the existing Acme demo.
2. To create a company, select **Neurofence operator → Onboard company**. Enter its identifier, first admin, environments and entitlements. The console switches to that admin.
3. In **People & teams**, add a Security admin or second Company admin. Set their status to Active through **Manage**. This simulates invitation acceptance; no email is sent.
4. Complete onboarding. In an empty environment, **Create demo application** adds sample providers, policies, routes, budgets and applications.
5. Edit **Configuration**, save a draft, validate and request review. Switch to the second reviewer, approve, then switch back and publish.
6. Inspect **Effective configuration** for an application. **History & audit** restores an earlier configuration into a new draft for review.

## Roles and inheritance

| Role                | Owns                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Neurofence operator | Company creation, entitlements, suspension and provisioning review; no product-data access |
| Company admin       | Settings, environments, people, teams and delegated permissions                            |
| Security admin      | Security policies, detectors and independent company review                                |
| Specialist roles    | Their product workflows and scoped resources                                               |

Keep one active Company admin. A company cannot grant operator authority. Reviewed role settings can narrow built-in capabilities. Revoking membership or permissions also prevents protected receipt replay. Team assignments extend Developer/Agent owner access to the assigned applications.

Configuration precedence is **company → assigned team → environment → application**. Company locks keep the company value. Application overrides identify both environment and application. Overrides cannot enable disabled modules, and enabled modules must fit operator entitlements.

## What settings affect

| Setting                                                                    | Effect                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Name, logo, color, timezone, density and landing page                      | Console appearance and display defaults                                       |
| Approved domains                                                           | New or changed member email addresses                                         |
| Modules and role capabilities                                              | Navigation, API access and runtime eligibility                                |
| Provider/model allowlists, residency, mandatory detectors and token limits | Additional checks on each application's published policy                      |
| Tool action classes and application budget ceilings                        | Pre-execution limits alongside existing resource rules                        |
| Privacy and retention                                                      | Raw-content eligibility and retention; holds preserve retained evidence       |
| Notification event choices                                                 | Action queue contents; destination delivery is not connected                  |
| Identity connection settings                                               | Validated configuration for a future identity adapter; SSO/SCIM is not active |

Company edits use the company version for concurrency. Publication invalidates stale policy bundles and binds new decisions to the new company version. Resource policies and budgets retain their own versions. Company rollback follows the same independent review process.

## Code and production handoff

| Location                                                           | Responsibility                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| `packages/contracts/src/company.ts`                                | Records, defaults, inheritance and locked-key resolution  |
| `packages/demo-backend/src/company/handler.ts`                     | Authorize and route company actions                       |
| `company/configuration.ts`, `people.ts`, `operator.ts`, `setup.ts` | Individual workflows within the backend company folder    |
| `company/transaction.ts`                                           | Directory persistence, versions, audit and retry receipts |
| `apps/console/src/features/company/`                               | Company pages, forms, role permissions and operator views |
| `packages/contracts/src/identity.ts`                               | Map an already verified identity to a membership          |
| `infra/database/001_company_control.sql`                           | Company schema and tenant isolation starting point        |

See [API conventions](api.md) and [OpenAPI](openapi.json) for request shapes and actions. Company actions except creation require the current company version, including member/team edits.

The dummy backend persists the company directory separately from environment state. Browser Web Locks coordinate supported tabs; the file-backed API requires one server process. Company receipts are bounded to 100 entries and approximately 750 KB, retaining the newest receipt.

For production, verify identity before membership mapping and use a restricted database role with tenant context. Commit company changes, audit, idempotency receipt and outbox event in one transaction. The supplied SQL is not the active demo storage adapter; domain-resource tables and migration tooling remain work.

Terraform manages infrastructure dependencies; company settings remain application records. **Ready for provisioning** records review only. Bind and populate company secret slots when deploying the real services; see [infrastructure](../infra/README.md#company-provisioning).
