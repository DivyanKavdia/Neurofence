# Mock BFF and production handoff

The React console uses the `Transport` interface in `packages/contracts/src/types.ts`. `apps/console/src/lib/api.ts` selects a browser-backed `MockBackend` or an HTTP transport. Both use the handlers in `packages/demo-backend/src/dispatch.ts`; the Node adapter adds file persistence and can inject the optional LiteLLM model connector. [openapi.json](openapi.json) describes the exposed BFF envelope, routes and runtime inputs.

## Run the HTTP dummy backend

```bash
npm ci
npm run mock
```

Open `http://127.0.0.1:8080`. This serves the built console, supplies HTTP mode through `/config.js`, and stores isolated demo workspaces under `.runtime/data/`. Restarting the server preserves records. The static Pages build uses browser storage and requires no backend process. Both default modes run without calling a model provider, MCP server or cloud service. To enable the LiteLLM execution adapter, use the explicit server configuration in [the integration guide](../integrations/litellm/README.md).

## Envelope and concurrency

Successful responses use `{ "data": ..., "meta": { "correlationId": "...", "revision": 1 } }`. Collections return an array in `data`; `meta.nextCursor` is present when another page exists. Lists accept `q`, `status`, `sort`, `cursor` and `limit` (1–100). Sorting is descending by the selected field. Detail and aggregate reads return objects. Times are epoch milliseconds and demo costs are INR numbers.

Every mutation includes `Idempotency-Key`. Editing or acting on an existing resource also includes its integer `version` in `If-Match`. A stale version returns 409 `VERSION_CONFLICT`; a missing version returns 428 `VERSION_REQUIRED`; reusing an idempotency key with a different payload returns 409 `IDEMPOTENCY_CONFLICT`. A valid repeat returns its receipt without repeating execution. Ordinary mock receipts last for the process/browser session. LiteLLM model execution additionally persists a request hash, trace and pending/completed receipt before and after the external call. Interrupted receipts return 409 `OUTCOME_UNKNOWN`; they never silently execute again. Production must move these records and reservations into transactional shared storage.

Errors use `{ "error": { "code": "...", "message": "...", "retryable": false, "correlationId": "..." } }`. Input, capability, context and entitlement checks run in the BFF as well as the interface. The UI preserves form values after errors and requires a reload after a stale edit. There is no automatic retry of a non-idempotent execution with a new request key.

## Implemented resource ownership

All paths below have prefix `/api/v1`. Generic CRUD applies only where the domain supports it; revocation, archival and published history are retained through actions.

| Resources                                        | Reads / writes and actions                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `workspace`, `session`, `capabilities`, `health` | GET aggregate/session/entitlements/dependency status                                                         |
| `settings`, `reset`                              | PATCH deployment/health demo scenarios; POST restore environment fixtures, preserving company configuration  |
| `providers`, `models`                            | Create/edit providers; provider `validate`, `discover`, `publish`, `status`; model `approve`                 |
| `projects`                                       | Create/edit; `issue`, `rotate`, `revoke`, `status`; plaintext demo key appears once in the action response   |
| `policies`, `routes`, `budgets`                  | Create; `draft`, `simulate`, `submit`, `canary`, `publish`, `promote`, `rollback`                            |
| `agents`, `servers`, `tools`                     | Create/edit; agent `workflow` reset/status, server `discover`, tool `approve` and status                     |
| `assets`                                         | Create/edit, `snapshot` AI-BOM, status and linked exceptions                                                 |
| `runtime/model`, `runtime/tool`, `inspect`       | POST governed sample execution or inspection; produce structured decisions and stages                        |
| `traces`                                         | Read; `reveal`, `replay`, `export`; replay prepares the playground outside Production                        |
| `approvals`                                      | Read; `decision` with Approved/Denied and a review reason; request creation follows the originating workflow |
| `incidents`                                      | Read; `review`, `contain`, `revoke`, `resolve`, `reopen`, `export` with reasons                              |
| `workforce`, `workforcePolicies`                 | Create sample events, edit event control, create/edit account/activity policies                              |
| `exceptions`                                     | Create time-bound request; approval updates the exception status                                             |
| `campaigns`, `scans`                             | Create/edit; `run`, `retest`, `remediate`, `gate`; job history and findings retained                         |
| `jobs`                                           | Poll execution state/progress; a completed job refreshes its associated resource                             |
| `integrations`, `savedViews`                     | Create/edit/delete; integration `test`                                                                       |
| `members`                                        | Read company memberships; mutation uses the company administration API                                       |
| `detectors`, `audit`                             | Read; detector status changes; append-only audit is emitted by actions                                       |

## State transitions

Policy, route and budget edits leave active fields unchanged. A draft must simulate successfully, receive an independent decision and then publish. Draft changes cancel prior draft approvals. Initial publication goes to all requests; a subsequent version can use the 10% canary. Rollback records a new version based on a previous snapshot. The mock allocation uses the request count modulo 100; production requires stable cohort assignment and monitored promotion criteria.

Tool approvals bind the agent, workflow, exact canonical arguments, resource, tool action, expiry and policy/configuration version. A review does not execute the call. An explicit identical rerun consumes the approval once. Budget approvals similarly bind one exact request and cannot override a hard limit. Configuration/access changes cancel unused approvals. Free-form governance exceptions record evidence; they do not grant implicit runtime bypasses.

Runtime traces carry `id`, `workflow`, `decisionId`, `policyVersion`, principal/application/agent context, classification signals, stage results, executed flag, tokens, reservation and cost. Normalize these camelCase BFF fields to the engineering baseline's `trace_id`, `workflow_id`, `decision_id`, `policy_version` at the service adapter boundary. Request blocks cost zero; response blocks retain provider charges. Timeout estimates stay charged pending a reconciliation job. The mock serializes transactions to prevent concurrent overspend; production needs durable atomic reservations and an outbox.

In LiteLLM mode, `modelRuntime`, `upstreamRequestId`, `inputTokens`, `outputTokens` and `billingBasis` identify the actual execution and reported usage. Its timeouts/ambiguous results retain an estimate without a synthetic reconciliation job. The UI receives inspected text immediately; when content retention is disabled the persisted trace contains content-omission markers. A replay after restart returns that metadata-only trace. The gateway ignores no security-relevant client overrides: endpoint, key, provider alias, region and rates come from operator configuration. SSE delivery is not implemented for this slice; upstream text is buffered before response inspection.

Assurance jobs expose `jobId`, running status, progress and completion through polling. Sample runs fail until a remediation reference is linked; retests then pass deterministically. This demonstrates the release workflow, not real assurance verification.

## Authentication, privacy and backend replacement

`X-Demo-*` headers select a dummy identity and scope. They are **not authentication**. Keep the HTTP mock on loopback; do not deploy it as the real control API. A production transport must use an authenticated OIDC/session flow, derive tenant/role/ownership server-side, and remove the role-preview/identity controls. The existing capability checks and UI affordances can then consume authenticated capabilities.

Default reads remove retained content and approval fingerprints. Reveal is a separate audited endpoint. Provider credentials are references only, and demo virtual credentials are not stored in plaintext. The current detector and masking examples are not production DLP. Reviewed trace-content purge and holds work in the demo store. Production encrypted storage, durable multi-tier retention, signed evidence and storage-level audit integrity remain backend work.

Replace the BFF service implementations behind the existing interface, starting with the governed model and MCP slices. Keep mock fixtures for local UX development and contract tests. Move large lists to the existing list API, add bounded aggregate summaries and production cursor semantics, then replace polling with the selected event transport. Publish the actual OpenAI-compatible gateway ingress separately from this control BFF; the sample application key/base-URL panel is an integration example, not a live provider endpoint.

The dependency values and provisioning sequence are in [infra/README.md](../infra/README.md).

The HTTP file store uses an encoded scope name under its private `scopes/` directory, atomically renames flushed files, and restricts their permissions. Legacy filenames with unambiguous tenant/environment IDs remain readable; ambiguous legacy filenames require ownership verification before migration. This prevents hyphenated scope identifiers from sharing a file.

## Operational workflows

These POST commands use `/api/v1/operations/{domain}/{action}` and the normal idempotency envelope. Updates to existing records require `If-Match`; inventory weight changes use the settings version. Import previews perform validation without committing the imported records. Batches are atomic and limited to 250 entries.

| Domain / actions                                 | Input and invariants                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory/preview`, `inventory/import`          | `source` plus `entries[]` with stable `externalId`, name, type, classification, optional owner, links and normalized components. Source + ID is unique within tenant/environment. Imports preserve reviewed ownership. Generic SPDX/CycloneDX files need normalization first.             |
| `inventory/weights`                              | Integer `protection`, `ownership`, `classification`, `approval` weights totaling 100; requires settings version.                                                                                                                                                                          |
| `detectors/save`                                 | Name, literal `terms[]`, `stages[]`; optional existing dictionary ID/version. Built-in implementations cannot be overwritten. Select the detector in a policy draft before publication.                                                                                                   |
| `finops/price`                                   | Model, epoch-ms `effectiveAt`, INR currency and input/output/cache/reasoning rates per million tokens. Effective versions are immutable.                                                                                                                                                  |
| `finops/usage-preview`, `finops/usage-import`    | Stable source/entry IDs, project, model, timestamp, disjoint input/output/cache/reasoning token counts and optional cost center. Input excludes cache reads; output excludes reasoning. Matching IDs are unchanged; conflicting usage requires reconciliation.                            |
| `finops/reconcile`                               | Trace ID/version, verified total INR `cost`, invoice reference and reason. Pending synthetic reconciliation jobs must finish first. Adjustments preserve prior amounts and execution receipts; no provider replay occurs.                                                                 |
| `evidence/hold`, `evidence/release`              | Trace ID/version and custody reason. A hold preserves already retained content but cannot recover purged or never-retained content.                                                                                                                                                       |
| `evidence/retention-preview`, `evidence/purge`   | Preview returns an eligibility token and metadata. Purge requires that token plus reason; holds, pending executions and changed previews prevent content deletion. Ledger amounts, trace metadata, receipts and audit are preserved.                                                      |
| `evidence/control`, `evidence/export`            | Map a named framework/control, owner, requirement and scoped evidence IDs; optional existing control ID/version. Export uses the control ID and returns a SHA-256 manifest without raw content/arguments.                                                                                 |
| `distribution/build`, `distribution/acknowledge` | Build with TTL 60–86400 seconds; acknowledge latest bundle ID/version and success/failure outcome. Building activates fail-closed acknowledgement enforcement. Expired, unacknowledged or stale published configuration cannot execute. Delivery is simulated; hashes are not signatures. |
| `assurance/schedule`, `assurance/provenance`     | Schedule a campaign ID/version with Manual/Daily/Weekly and next-run epoch milliseconds; or record a scan ID/version with SHA-256 digest, publisher and license. Changed provenance invalidates remediation/release and requires retest.                                                  |

New read-only collections are `prices`, `controls` and `distributions`; mutate them through workflow commands. Governance owner/Security admin can manage custody and mappings; Auditor can export mapped evidence. Developer/Agent owner cannot read other owners' evidence mappings or distribution bundles. Module entitlements apply to workflow commands.

`runtime/tool` also accepts an ordered `delegates[]` list and a mock `responsePreset` (`safe`, `pii`, `injection`). The approval fingerprint includes the delegation versions and response fixture. `runtime/model` accepts an optional agent ID only for mock execution; live agent calls fail closed until operator model binding exists. Agent fields include `allowedModels`, `allowedDelegates`, `maxCost` and `maxModelCalls`; absent grants remain empty. Both paths check application credential expiry.

`inspect` supports Request, Response, Tool arguments and Tool result. Dictionary matching is case-insensitive and literal. Findings expose detector/rule IDs and UTF-16 offsets, not raw matched values. Confidence 1 denotes an exact fixture match. Inputs over 200,000 characters are rejected; exceeding 1,000 matches fails closed instead of partially inspecting content.

## Company administration API

See [company administration](company-administration.md#code-and-api-map) for onboarding, memberships, teams, configuration releases, overrides and provisioning endpoints. Company mutations use the company version in `If-Match`; draft publication always requires an independent active reviewer. Company configuration is enforced by the same shared workflow engine in browser and HTTP mode.
