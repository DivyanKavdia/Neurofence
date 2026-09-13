# Mock BFF and production handoff

The React console uses the `Transport` interface in `src/types.ts`. `src/api.ts` selects a browser-backed `MockBackend` or an HTTP transport. Both dummy backends execute the same handlers in `src/backend.ts`; the Node adapter changes only persistence and transport. [openapi.json](openapi.json) describes the exposed BFF envelope, routes and runtime inputs.

## Run the HTTP dummy backend

```bash
npm ci
npm run mock
```

Open `http://127.0.0.1:8080`. This serves the built console, supplies HTTP mode through `/config.js`, and stores isolated demo workspaces under `.runtime/data/`. Restarting the server preserves records. The static Pages build uses browser storage and requires no backend process. Both modes run without calling a model provider, MCP server or cloud service.

## Envelope and concurrency

Successful responses use `{ "data": ..., "meta": { "correlationId": "...", "revision": 1 } }`. Collections return an array in `data`; `meta.nextCursor` is present when another page exists. Lists accept `q`, `status`, `sort`, `cursor` and `limit` (1–100). Sorting is descending by the selected field. Detail and aggregate reads return objects. Times are epoch milliseconds and demo costs are INR numbers.

Every mutation includes `Idempotency-Key`. Editing or acting on an existing resource also includes its integer `version` in `If-Match`. A stale version returns 409 `VERSION_CONFLICT`; a missing version returns 428 `VERSION_REQUIRED`; reusing an idempotency key with a different payload returns 409 `IDEMPOTENCY_CONFLICT`. A valid repeat returns the original receipt without repeating execution. Receipts currently last for the mock process/browser session, so a production backend must persist them transactionally.

Errors use `{ "error": { "code": "...", "message": "...", "retryable": false, "correlationId": "..." } }`. Input, capability, context and entitlement checks run in the BFF as well as the interface. The UI preserves form values after errors and requires a reload after a stale edit. There is no automatic retry of a non-idempotent execution with a new request key.

## Implemented resource ownership

All paths below have prefix `/api/v1`. Generic CRUD applies only where the domain supports it; revocation, archival and published history are retained through actions.

| Resources | Reads / writes and actions |
| --- | --- |
| `workspace`, `session`, `capabilities`, `health` | GET aggregate/session/entitlements/dependency status |
| `settings`, `reset` | PATCH versioned settings; POST restore the current tenant/environment fixture |
| `providers`, `models` | Create/edit providers; provider `validate`, `discover`, `publish`, `status`; model `approve` |
| `projects` | Create/edit; `issue`, `rotate`, `revoke`, `status`; plaintext demo key appears once in the action response |
| `policies`, `routes`, `budgets` | Create; `draft`, `simulate`, `submit`, `canary`, `publish`, `promote`, `rollback` |
| `agents`, `servers`, `tools` | Create/edit; agent `workflow` reset/status, server `discover`, tool `approve` and status |
| `assets` | Create/edit, `snapshot` AI-BOM, status and linked exceptions |
| `runtime/model`, `runtime/tool`, `inspect` | POST governed sample execution or inspection; produce structured decisions and stages |
| `traces` | Read; `reveal`, `replay`, `export`; replay prepares the playground outside Production |
| `approvals` | Read; `decision` with Approved/Denied and a review reason; request creation follows the originating workflow |
| `incidents` | Read; `review`, `contain`, `revoke`, `resolve`, `reopen`, `export` with reasons |
| `workforce`, `workforcePolicies` | Create sample events, edit event control, create/edit account/activity policies |
| `exceptions` | Create time-bound request; approval updates the exception status |
| `campaigns`, `scans` | Create/edit; `run`, `retest`, `remediate`, `gate`; job history and findings retained |
| `jobs` | Poll execution state/progress; a completed job refreshes its associated resource |
| `integrations`, `members`, `savedViews` | Create/edit/delete; integration `test`; member invitation is a sample record only |
| `detectors`, `audit` | Read; detector status changes; append-only audit is emitted by actions |

## State transitions

Policy, route and budget edits leave active fields unchanged. A draft must simulate successfully, receive an independent decision and then publish. Draft changes cancel prior draft approvals. Initial publication goes to all requests; a subsequent version can use the 10% canary. Rollback records a new version based on a previous snapshot. The mock allocation uses the request count modulo 100; production requires stable cohort assignment and monitored promotion criteria.

Tool approvals bind the agent, workflow, exact canonical arguments, resource, tool action, expiry and policy/configuration version. A review does not execute the call. An explicit identical rerun consumes the approval once. Budget approvals similarly bind one exact request and cannot override a hard limit. Configuration/access changes cancel unused approvals. Free-form governance exceptions record evidence; they do not grant implicit runtime bypasses.

Runtime traces carry `id`, `workflow`, `decisionId`, `policyVersion`, principal/application/agent context, classification signals, stage results, executed flag, tokens, reservation and cost. Normalize these camelCase BFF fields to the engineering baseline's `trace_id`, `workflow_id`, `decision_id`, `policy_version` at the service adapter boundary. Request blocks cost zero; response blocks retain provider charges. Timeout estimates stay charged pending a reconciliation job. The mock serializes transactions to prevent concurrent overspend; production needs durable atomic reservations and an outbox.

Assurance jobs expose `jobId`, running status, progress and completion through polling. Sample runs fail until a remediation reference is linked; retests then pass deterministically. This demonstrates the release workflow, not real assurance verification.

## Authentication, privacy and backend replacement

`X-Demo-*` headers select a dummy identity and scope. They are **not authentication**. Keep the HTTP mock on loopback; do not deploy it as the real control API. A production transport must use an authenticated OIDC/session flow, derive tenant/role/ownership server-side, and remove the role-preview/identity controls. The existing capability checks and UI affordances can then consume authenticated capabilities.

Default reads remove retained content and approval fingerprints. Reveal is a separate audited endpoint. Provider credentials are references only, and demo virtual credentials are not stored in plaintext. The current detector and masking examples are not production DLP. Durable retention deletion, encrypted storage, signed evidence and audit integrity belong in the backend.

Replace the BFF service implementations behind the existing interface, starting with the governed model and MCP slices. Keep mock fixtures for local UX development and contract tests. Move large lists to the existing list API, add bounded aggregate summaries and production cursor semantics, then replace polling with the selected event transport. Publish the actual OpenAI-compatible gateway ingress separately from this control BFF; the sample application key/base-URL panel is an integration example, not a live provider endpoint.

The dependency values and provisioning sequence are in [infra/README.md](../infra/README.md).
