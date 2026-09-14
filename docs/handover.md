# Developer handover

You can develop and test the console without a production backend. The same demo business rules run in the browser or behind a local HTTP API.

## Your first session

1. Follow the [README setup](../README.md#run-locally) and open the console.
2. As Company admin, create a **Demo studio** scenario and run its request. Follow the result into traces, incidents or approvals.
3. Open **Guardrails → Test lab** and compare the starter suite. Edit a policy draft to see how the comparison changes.
4. Use **Preview as** to try a second reviewer. Company configuration requires independent approval before publication.
5. Run `npm test` after the [browser install](development.md#test-your-change).

Then read [architecture](architecture.md) and locate the feature you will own. The [company guide](company-administration.md) and [demo guide](demo-and-policy-testing.md) explain those flows in detail.

## Know the boundaries

| Available now                                           | Still needed for production                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Company setup, role previews and permission checks      | Verified sign-in, SSO/SCIM, authenticated server-side membership          |
| Browser/file persistence and versioned edits            | Transactional shared storage, distributed reservations and durable jobs   |
| Optional governed LiteLLM text calls                    | Production gateway ingress, streaming, caching and charge reconciliation  |
| Pattern/dictionary inspection and sample tool decisions | Production detectors, OCR, live MCP execution and credential brokerage    |
| Inventory, workforce, assurance and evidence workflows  | Collectors, real scanners, external delivery and durable evidence storage |
| Terraform dependency definitions and company SQL schema | Application services, migrations and an account-specific deployment       |

The local API uses demo identity headers. It is a development adapter. Selecting a deployment profile or approving a provisioning request does not deploy a backend.

## Where to make your first change

| Task                         | Start here                                                             |
| ---------------------------- | ---------------------------------------------------------------------- |
| Change the app frame         | `apps/console/src/app/layout/`                                         |
| Change a page or form        | `apps/console/src/features/<feature>/`                                 |
| Change company behavior      | `packages/demo-backend/src/company/handler.ts`, then its named handler |
| Add a business action        | `packages/demo-backend/src/workflows/` or `resources/`                 |
| Connect a production service | [API conventions](api.md), then `apps/api/src/`                        |

Keep UI code, business rules and storage adapters separate. Follow an existing feature through its page, handler and test before extending it. [Development](development.md#make-a-change) has the working conventions.

## Suggested backend order

1. Authenticate requests and resolve company membership on the server. `sessionForVerifiedIdentity` is the mapping interface; it does not verify tokens.
2. Implement transactional storage behind the API. Use `infra/database/001_company_control.sql` as the company schema starting point; add the domain tables and migration process.
3. Move execution receipts, reservations and jobs into durable shared services. Preserve exact-request approval and retry behavior.
4. Connect real model/tool/inspection adapters, then collectors, scanners and evidence delivery. Use the [scope map](product-scope.md) to select a bounded slice.

The supplied Native Gateway v2 documents describe the target platform. Current code uses an optional vendored LiteLLM adapter behind `ProviderConnector`. Confirm which target services the team will build before treating a design diagram as an implemented service map.
