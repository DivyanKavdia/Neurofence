# API conventions

The console calls a `Transport` from `packages/contracts/src/types.ts`. Browser mode uses `MockBackend` directly. HTTP mode sends the same requests through `apps/api/src/server.ts`. The shared business handlers live in `packages/demo-backend/src/`.

Run `npm run mock` and open `http://127.0.0.1:8080`. The server supplies HTTP configuration and persists records in `.runtime/data/`. Exact endpoint and input definitions are in [OpenAPI](openapi.json).

## Requests and responses

All control paths start with `/api/v1`. A successful response is:

```json
{ "data": {}, "meta": { "correlationId": "request-id", "revision": 1 } }
```

An error is:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "This record changed.",
    "retryable": false,
    "correlationId": "request-id"
  }
}
```

Collection reads accept `q`, `status`, `sort`, `cursor` and `limit` (1–100). They return an array and optional `meta.nextCursor`. Sort order is descending. Timestamps are epoch milliseconds; demo cost amounts are INR.

Every mutation requires `Idempotency-Key`. Actions on existing records also require `If-Match` with the current integer version. Use the **company version** for company/member/team changes, the **suite version** for policy tests, and the **workspace revision** for a managed demo reset. Demo creation/restoration uses the company version.

| Error                      | Meaning and response                                                             |
| -------------------------- | -------------------------------------------------------------------------------- |
| 428 `VERSION_REQUIRED`     | Supply the current version                                                       |
| 409 `VERSION_CONFLICT`     | Reload before applying an edit to newer state                                    |
| 409 `IDEMPOTENCY_CONFLICT` | The key was reused with different input; correct the request                     |
| 409 `OUTCOME_UNKNOWN`      | An external execution may have happened; reconcile its trace before another call |
| 403 `FORBIDDEN`            | The current identity lacks the capability or scope                               |

A valid repeat returns its recorded result. Ordinary receipts last for the backend instance; company receipts persist in a bounded directory, and external model receipts persist in the workspace. Permission checks still apply when replaying a receipt.

## Find the handler

Paths below omit `/api/v1`. Use OpenAPI for the full action list and schemas.

| Endpoint family                                                            | Code owner                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `workspace`, `session`, `settings`, `health`, `reset`                      | `handlers/workspace.ts`, `handlers/controls.ts`                          |
| `companies`, `company`                                                     | `company/handler.ts`; operator, configuration, people and setup handlers |
| Resource lists/details and lifecycle actions                               | `resources/`; collection definitions in `resources/schema.ts`            |
| `runtime/model`, `runtime/tool`, `inspect`                                 | `handlers/runtime.ts` and `execution/`                                   |
| `approvals`, `incidents`, `traces`                                         | Their named files in `handlers/`                                         |
| Inventory, FinOps, evidence, distribution, assurance and detector commands | `handlers/operations.ts` and `workflows/`                                |
| `policy-tests`                                                             | `workflows/policy-lab.ts`                                                |
| `demo`                                                                     | `workflows/demo.ts` and `demo-backup.ts`                                 |

Handler paths are relative to `packages/demo-backend/src/`. Generic CRUD is available only where the domain allows it; published records use lifecycle actions.

## Behavior the production adapter must preserve

- Drafts do not replace active policy. Configuration changes require the relevant validation and review before publication. Company changes always require an independent active reviewer.
- Tool approvals bind the agent, workflow, arguments, action, resource, expiry and configuration version. Review does not execute the call; an identical rerun consumes approval once. Budget approval cannot bypass a hard limit.
- Request denial incurs no provider charge. Response denial retains incurred charges. External execution persists its reservation and pending receipt before calling LiteLLM; ambiguous outcomes must not silently retry.
- Default reads omit raw content and approval fingerprints. Revealing retained content is a separate audited action. Content purge preserves ledger, receipts and audit metadata.
- Current model responses are buffered before inspection. A `streaming` setting does not enable SSE in this adapter. Live aliases, rates, regions and credentials come from server configuration.
- Company/environment scope, capabilities and ownership are checked in the backend. An interface-only restriction is insufficient.

## Replace the dummy backend

`X-Demo-*` headers are identity previews. The HTTP mock binds loopback and rejects production auth settings. A real adapter must verify the session/token, derive company membership and capabilities server-side, and remove demo role switching. `sessionForVerifiedIdentity` maps already verified claims; it does not verify tokens.

Keep the transport contract while replacing storage and external adapters. Move receipts, reservations, audits and events into transactional shared storage. Use list endpoints and bounded summaries as datasets grow. The public OpenAI-compatible gateway ingress is separate work from this control API. See [handover](handover.md#suggested-backend-order) and the [LiteLLM guide](../integrations/litellm/README.md) for the next steps.
