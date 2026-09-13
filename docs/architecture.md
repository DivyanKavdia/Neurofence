# Architecture and ownership

Neurofence currently consists of a React console, a shared TypeScript demo control plane, a local Node HTTP adapter and an optional LiteLLM model runtime. The supplied Native Gateway v2 design describes the target production services. The running prototype demonstrates their workflows and contracts; it does not implement every production service in that design.

## Code boundaries

| Area | Owns | Depends on |
| --- | --- | --- |
| `apps/console` | Pages, editors, navigation, local session preview and transport selection | Shared contracts; demo backend in browser mode |
| `apps/api` | HTTP envelopes, loopback serving, persistent file storage and LiteLLM connection configuration | Shared contracts and demo backend |
| `packages/contracts` | Resource/transport types, capabilities, provider interface and budget attribution | No application or filesystem code |
| `packages/demo-backend` | Demo state, authorization checks, versioning, approvals, budget decisions, traces and synthetic jobs | Contracts and an optional injected `ProviderConnector` |
| `integrations/litellm` | Runtime entry point, deployment configuration and source provenance | Tracked `vendor/litellm` source and pinned dependency image |
| `infra` | Dependency provisioning for future backend services | Operator-supplied account, state and deployment settings |

Imports from shared code use `@neurofence/contracts/*` and `@neurofence/demo-backend`, resolved by the root TypeScript configuration and build. Inside an area, use relative imports. Application code must not become a dependency of a shared package. Node filesystem code and provider secrets belong in the API, outside the browser bundle.

## Three execution modes

The console selects a `Transport` in `apps/console/src/lib/api.ts`. The public `config.js` defaults to browser mode. Browser mode instantiates `MockBackend` with `BrowserStore`; the HTTP server supplies its own `config.js` and instantiates the same backend with `FileStore`. Both run the same resource handlers.

In LiteLLM mode, the HTTP server also injects `LiteLLMConnector` from `apps/api/src/providers/litellm.ts`. Neurofence still chooses the route, checks policy and budgets, owns the request receipt, inspects the response and records the trace. LiteLLM translates the approved text request to the configured provider protocol. The browser never receives its credential or chooses an upstream URL.

The included source is a regular tracked directory, imported from the user's LiteLLM fork. Runtime verification checks the content digest and the imported Python module path. This profile uses Python; the retained Rust source is not compiled or enabled. The optional integration follows the decision to embed LiteLLM while retaining the product-owned `ProviderConnector` boundary. See the [runtime guide](../integrations/litellm/README.md) for source updates and [third-party notices](../THIRD_PARTY_NOTICES.md) for provenance and license boundaries.

## Follow a request

1. A feature calls `request` or `mutate` through `ConsoleContext`. Mutations carry a request key and, when editing an existing record, its version.
2. `backend.ts` captures the session and serializes the transaction. `context.ts` clones the tenant/environment workspace and supplies scoped lookup, version checks, auditing and persistence.
3. `dispatch.ts` checks repeat receipts before running jobs or routing the request. Workspace/runtime handlers run before collection reads, review actions and resource mutations.
4. Resource handlers in `resources/` validate fields, manage drafts and record lifecycle changes. Approval and incident actions live in `handlers/`.
5. `execution/model.ts` and `execution/tool.ts` evaluate access, active policy, route eligibility and budgets. Inspection, budget approvals and trace creation are separate modules. MCP calls remain simulated.
6. Before an external model call, the runtime handler persists a pending receipt, trace and conservative reservation. The connector sends the approved request once; response inspection and reported usage update the same trace. Ambiguous outcomes retain the reservation.
7. The transaction persists a scoped snapshot and returns the BFF envelope. If content retention is off, real request/response content is removed from the saved trace. A completed repeat returns the existing receipt; an interrupted external call requires reconciliation.

The [API guide](api.md) specifies exact errors, state transitions and privacy behavior. Keep request ordering and persistence checkpoints intact when changing handlers: moving a check after a provider call can change both enforcement and billing.

## State and migration

Browser data is keyed by tenant and environment. The file store encodes that same scope into a private filename and uses flushed writes plus atomic replacement. Existing browser fixtures and unambiguous legacy file names still migrate; the legacy fixture supports that behavior and its regression test.

This is one serialized backend instance, not a distributed database. Ordinary repeat receipts live in memory; external model receipts are also persisted with the workspace. Production needs transactional shared reservations and receipts, authenticated principals, reconciliation workers and event delivery. Do not infer production guarantees from a passing demo workflow.

## What is implemented versus planned

| Capability | Current implementation | Production handoff |
| --- | --- | --- |
| Console and review workflows | Interactive pages, role preview, versioned edits and synthetic records | Authenticated sessions and production capabilities |
| Model execution | Browser simulation or optional governed LiteLLM text chat; buffered response inspection | Production identity, real detectors, reconciliation and separately specified streaming/other endpoints |
| MCP and workforce controls | Exact sample approvals and simulated activity | Live tool execution, auth brokerage and collection agents |
| Inventory, assurance and evidence | Editable inventory, synthetic jobs, exports and audit records | Discovery, real scanners, retention deletion and signed evidence |
| Persistence and quotas | Browser/file store and serialized sample transactions | PostgreSQL, distributed reservations/cache, durable events and analytics |
| Hosting | Static GitHub Pages console and local processes | Reviewed Terraform plans, service images, ingress and account-specific deployment |

The [product scope](product-scope.md) preserves the supplied screen/workflow mapping. The [infrastructure guide](../infra/README.md) maps PostgreSQL, Valkey, Kafka, ClickHouse, object storage, OPA, secrets and telemetry to future consumers. Those dependencies are deliberately optional for frontend development.
