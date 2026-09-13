# NeuralFence

A React/TypeScript enterprise AI trust console covering the 25 primary screens and nine workflows in the supplied Native Gateway UI scope. Version 0.5 adds an optional LiteLLM provider adapter to the frontend and stateful prototype BFF, while retaining the default offline demo.

![Command center](docs/screenshots/command-center.png)

## Open or run

Open [NeuralFence on GitHub Pages](https://divyankavdia.github.io/Neurofence/) or the repository's built `index.html` directly in a browser. The static console runs offline with browser storage.

For development, use Node.js 24:

```bash
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:8000`. Rebuild after changing source. To use the same dummy backend over HTTP with persistent local records:

```bash
npm run mock
```

Open `http://127.0.0.1:8080`. No database or cloud account is needed for either demo mode.

For the integrated LiteLLM fixture, fork/source build instructions and later live-provider configuration, follow [integrations/litellm/README.md](integrations/litellm/README.md). The source now uses [DivyanKavdia/litellm](https://github.com/DivyanKavdia/litellm), pinned to the tested v1.100.1 commit. The container remains the tested upstream image until a fork image is built and selected by digest. The existing playground can already call the actual LiteLLM proxy, apply request/response checks and record its token usage through the local BFF.

## What is connected

Use **Explore workflows** to enter a guided journey. There are 10 navigation areas and 36 page/tab views, plus detail, editor and review dialogs.

- Provider onboarding: validate a secret reference, discover models, approve deployments and publish the catalog.
- Applications: bind route, guardrail and budget; issue/rotate/revoke a demo key; test allowed, redacted, blocked and timeout requests.
- Policies and routes: edit immutable drafts, simulate impact, request independent review, publish a canary, promote or roll back.
- Agents and MCP: register identity/purpose, scope tools and data, inspect schemas, approve an exact request once, and enforce workflow limits.
- FinOps: create hierarchical budgets, inspect period-attributed usage, quotas, threshold actions, forecasts, anomalies and allocation exports.
- Incident response: investigate trace/evidence, assign and annotate, contain/revoke, resolve/reopen and export findings.
- Workforce AI: simulate account/activity events, configure coaching and controls, and review time-bound exceptions.
- Assurance: run campaigns and supply-chain jobs, inspect failures, link remediation, retest and release the gate.
- Governance: review approvals, exceptions, evidence, audit, integrations, members, capabilities, deployment and retention settings.

The role preview and profile menu let you test capabilities and switch to an independent reviewer. The mobile navigation provides the same flows through cards and dialogs. Tables support search, filtering, sorting, columns, saved views, pagination and exports; global search and hash links open related objects.

The complete screen mapping is in [docs/SCOPE.md](docs/SCOPE.md).

## Mock and real backend boundary

The browser and Node dummy backends share version checks, idempotency, scope enforcement, single-use approvals, period budgets, request/response decisions, cost reconciliation and audit generation. The browser stores data by tenant/environment; the HTTP mock stores it under `.runtime/data/`. Older v0.3 browser fixtures migrate when first opened; unused legacy approvals are cancelled for a fresh version-bound review. **Reset demo** restores the current workspace only.

The default demo is synthetic: identities, credentials, providers, tools, workforce events, detector/OCR results, scans, prices and evidence integrity. LiteLLM mode optionally replaces model execution only; it does not turn the other prototypes into production services. `X-Demo-*` headers are not authentication. Do not deploy the HTTP mock as a production control API.

[docs/API.md](docs/API.md) explains the replaceable transport and integration sequence. [docs/openapi.json](docs/openapi.json) contains the BFF contract. Begin the real backend with the governed model and MCP call slices while retaining these UI workflows.

## Cloud dependencies for later

[infra/README.md](infra/README.md) maps every backend dependency and gives the provisioning sequence. Terraform contains AWS Mumbai network/EKS/ECR, RDS PostgreSQL, ElastiCache Valkey, MSK, encrypted S3 evidence, KMS/Secrets Manager and IAM; a second root installs ClickHouse, OPA and OpenTelemetry. Local Compose definitions mirror the dependency interfaces.

No cloud resources have been created. GitHub CI passes formatting and provider validation for both Terraform roots, plus both credential-free AWS mock plans. Review an account-specific plan before applying; the platform plan requires an existing cluster and VPC connectivity.

## Verification

```bash
npm ci
npx playwright install --with-deps chromium
npm test
```

The gate checks TypeScript, builds the console, runs API/HTTP tests and drives browser workflows and layouts at 320, 390, 768 and 1440 pixels. Results and screenshots are written to `test-results/`. `NEUROFENCE_BROWSER_PATH` selects an existing Chromium executable; `NEUROFENCE_SOFTWARE_RENDERING=1` enables the constrained headless graphics configuration.

[docs/VALIDATION.md](docs/VALIDATION.md) records completed checks and remaining gates. CI contains the same frontend gate and credential-free Terraform validation/mock-plan jobs; it does not apply infrastructure.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/main.tsx`, `src/pages.tsx`, `src/catalogs.tsx`, `src/ui.tsx` | Application shell, pages, domain forms/details, shared controls |
| `src/types.ts`, `src/api.ts`, `src/backend.ts`, `src/ledger.ts` | Contracts, replaceable transport, mock BFF and budget calculations |
| `src/seed.ts`, `src/legacy-fixture.ts` | Demo data and migration from the previous prototype |
| `server/mock-server.ts` | Optional loopback HTTP BFF with file persistence |
| `src/provider.ts`, `server/litellm.ts` | Provider execution contract and server-only LiteLLM adapter |
| `integrations/litellm/`, `vendor/litellm` | Fixture/live configuration, source lock, fork workflow and pinned fork submodule |
| `scripts/` | Static build, local server and Terraform output handoff |
| `index.html`, `config.js`, `assets/console/` | Committed, self-contained static build |
| `assets/brand/` | Approved identity, font and reusable marks |
| `infra/`, `docs/`, `tests/` | Provisioning definitions, scope/API handoff and verification |

Publishing uses the existing GitHub Pages `main` → repository-root flow. Run the frontend and infrastructure CI gates before merging changes into `main`; the committed static build is the Pages artifact.
