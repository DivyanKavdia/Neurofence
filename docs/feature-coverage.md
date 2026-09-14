# Feature coverage and remaining work

This is the implementation audit against the **102 normalized M1–M9 functional requirements** in `Enterprise_AI_Trust_Fabric_Coding_Context_Native_Gateway_v2.md`, checked alongside the v1 UI functional design and v2 low-level design. The source design describes a production platform; the current deliverable is an interactive console with a stateful dummy backend and optional configured LiteLLM text execution.

**Demo** means the stated workflow runs and persists locally. **Partial** means part of the requirement runs and the remaining work is named. **Gap** means no working implementation of that requirement. None of these labels certify production readiness.

## Flows added by this audit

| Console entry                         | Working additions                                                                                                                                   | Main backend owner                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| AI inventory → Discovery & risk       | JSON file/paste import, atomic preview/apply, duplicate detection, preserved ownership, component history, configurable 0–100 risk and contributors | `workflows/inventory.ts`                                            |
| Guardrails → Detectors / Simulator    | Literal dictionaries, stage selection, safe redaction, rule/span evidence and bounded inspection                                                    | `workflows/detectors.ts`, `execution/inspect.ts`                    |
| Agents & MCP → Workflows & delegation | Explicit delegation, model grants, workflow call/cost limits, tool-result inspection, correlated traces                                             | `execution/authority.ts`, `execution/tool.ts`, `execution/model.ts` |
| FinOps → Prices & reconciliation      | Effective price versions, disjoint token categories, duplicate-safe external usage, cost centers and invoice adjustments                            | `workflows/finops.ts`                                               |
| Governance → Evidence lifecycle       | Hold/release, stale-safe purge preview, retained ledger metadata, control mappings and integrity exports                                            | `workflows/evidence.ts`                                             |
| Governance → Policy distribution      | Bundle build, acknowledgement/failure/retry, integrity checks, expiry and configuration-drift enforcement                                           | `workflows/distribution.ts`                                         |
| Assurance → Schedules & provenance    | Daily/weekly sample scheduling, digest/publisher/license history, drift quarantine and retest gates                                                 | `workflows/assurance.ts`, `execution/jobs.ts`                       |
| Global actions                        | Role-scoped action queue and contextual help, including mobile profile-menu access                                                                  | `app/WorkspaceAssistance.tsx`                                       |

Backend paths above are under `packages/demo-backend/src/`; UI paths are under `apps/console/src/`. Browser/file workspaces migrate additively: existing decisions and explicit denials are preserved. Agent model/delegate grants default to empty when absent. Existing risk labels remain available; calculated risk is recorded separately.

## Requirement-by-requirement coverage

### M1

| Requirement                     | State   | Implementation and remaining work                                                                                                      |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| M1-FR-001 — Asset ingestion     | Partial | Manual registration, telemetry-derived records and atomic normalized JSON imports work. Cloud, CMDB and CI collectors remain adapters. |
| M1-FR-002 — AI-BOM              | Partial | Versioned links and component metadata work. The relationship graph needs automatic reconciliation across every service.               |
| M1-FR-003 — Shadow AI discovery | Partial | Sample account/asset classifications work. Actual shadow-AI detection requires workforce collectors.                                   |
| M1-FR-004 — Risk scoring        | Demo    | Configurable weights sum to 100; scores expose protection, ownership, classification and approval contributors.                        |
| M1-FR-005 — Ownership workflow  | Partial | Owner, classification and lifecycle edits work; automatic ownership routing and completeness escalation remain.                        |
| M1-FR-006 — Control coverage    | Partial | Coverage labels and policy/route/budget relationships work; per-control verified deployment coverage remains.                          |
| M1-FR-007 — Exceptions          | Demo    | Scoped, expiring exceptions have reasons and independent review. Generic exceptions do not bypass enforcement.                         |
| M1-FR-008 — Command Center      | Demo    | Command center, metrics, action queue and scoped aggregates work on the demo ledger.                                                   |
| M1-FR-009 — Graph search        | Partial | Search and relationship pivots work. A general graph query service remains.                                                            |
| M1-FR-010 — Compliance mapping  | Demo    | Customer framework controls can link scoped evidence and export an integrity manifest.                                                 |

### M2

| Requirement                             | State   | Implementation and remaining work                                                                              |
| --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| M2-FR-001 — AI app detection            | Gap     | Real URL/process/TLS fingerprint collection is not implemented.                                                |
| M2-FR-002 — Tenant/instance control     | Partial | Enterprise/personal/unknown sample instances affect controls; real instance recognition remains.               |
| M2-FR-003 — Activity control            | Partial | Visit, prompt, paste, upload and download sample actions work; response capture and sign-in collectors remain. |
| M2-FR-004 — Inline DLP handoff          | Partial | Sample controls demonstrate DLP actions; the live inline DLP handoff remains.                                  |
| M2-FR-005 — User coaching               | Demo    | Coaching, justification and exception review work on sample activity.                                          |
| M2-FR-006 — Endpoint posture            | Partial | Device metadata appears in activity; live MDM/EDR claims and posture enforcement remain.                       |
| M2-FR-007 — CLI/thick-client visibility | Gap     | CLI and thick-client endpoint enforcement are not implemented.                                                 |
| M2-FR-008 — Offline policy              | Gap     | Workforce offline policy expiry is not implemented; gateway bundle expiry is a separate control.               |
| M2-FR-009 — Privacy modes               | Partial | Masked reads and retained-content controls work; endpoint privacy filtering and consent collection remain.     |
| M2-FR-010 — Incident export             | Partial | Incident and evidence exports work; actual collector/SIEM delivery remains.                                    |

### M3

| Requirement                         | State   | Implementation and remaining work                                                                                     |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| M3-FR-001 — Detector pipeline       | Partial | Ordered stage-aware sample detectors work; independent latency budgets and production detector orchestration remain.  |
| M3-FR-002 — Sensitive data          | Partial | Identifiers/secrets and dictionaries emit rule IDs, spans and exact-match confidence; trained classifiers remain.     |
| M3-FR-003 — Redaction/tokenization  | Partial | Span-aware redaction works. Reversible vault-backed tokenization is not implemented.                                  |
| M3-FR-004 — Prompt injection        | Partial | Deterministic injection patterns cover request and tool stages; adaptive attacks need production classifiers.         |
| M3-FR-005 — Content safety          | Partial | An explicit unsafe-content fixture can exercise response policy; general moderation classifiers remain.               |
| M3-FR-006 — OCR/document extraction | Partial | Text imports work; PDF/image extraction uses a labeled sample and needs a real OCR adapter.                           |
| M3-FR-007 — Response inspection     | Demo    | Model responses and tool results are checked before display; withheld results retain incurred charges.                |
| M3-FR-008 — Custom detectors        | Partial | Bounded literal dictionaries can be created, edited, staged and added to policies. Arbitrary detector plugins remain. |
| M3-FR-009 — Policy obligations      | Partial | Allow, redact, block, monitor and reviewed actions work; a general obligations contract remains.                      |
| M3-FR-010 — Performance isolation   | Partial | Input and match-count limits fail closed; separate detector workers, timeouts and concurrency budgets remain.         |
| M3-FR-011 — Multilingual            | Gap     | There is no validated multilingual detector pack.                                                                     |
| M3-FR-012 — Explainability          | Demo    | Traces and simulator expose rule IDs, spans, stage, decision and policy version without raw matched values.           |

### M4

| Requirement                           | State   | Implementation and remaining work                                                                                                |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| M4-FR-001 — OpenAI-compatible ingress | Partial | The integrated LiteLLM service exposes its ingress; the governed Neurofence BFF needs production OpenAI-compatible routing/auth. |
| M4-FR-002 — Provider adapters         | Partial | Included LiteLLM can execute configured text providers; native onboarding validation is still simulated.                         |
| M4-FR-003 — Virtual credentials       | Partial | Issue/rotate/revoke, project bindings and expiry work; demo credentials are not usable production authentication.                |
| M4-FR-004 — Credential vault          | Partial | Secret references and server-only configured credentials work; managed vault retrieval/rotation remains.                         |
| M4-FR-005 — Model catalog/allowlist   | Partial | Model approval and mock agent model grants work. Live agent calls require an operator-bound model identity.                      |
| M4-FR-006 — Routing                   | Demo    | Primary/fallback, residency, health and cost/budget routing decisions work.                                                      |
| M4-FR-007 — Retries/fallback          | Partial | Fallback selection and retry configuration exist; live requests deliberately do not retry ambiguous outcomes.                    |
| M4-FR-008 — Rate limits               | Partial | Local serialized rate/token/concurrency checks work; distributed enforcement remains.                                            |
| M4-FR-009 — Caching                   | Gap     | Exact and semantic cache lookup, TTL policy and invalidation are not implemented.                                                |
| M4-FR-010 — Streaming                 | Gap     | SSE/chunk streaming is not implemented. The current text path buffers before response inspection.                                |
| M4-FR-011 — Guardrail hooks           | Demo    | Pre-request and post-response inspection surround both mock and configured LiteLLM text execution.                               |
| M4-FR-012 — Usage normalization       | Partial | Input/output usage works; imports add disjoint cache/reasoning categories. Live categories need provider normalization.          |
| M4-FR-013 — Health management         | Partial | Sample health and actual LiteLLM reachability work; distributed health probes/circuit state remain.                              |
| M4-FR-014 — Admin APIs                | Demo    | Versioned provider/model/route/project administration works against the shared BFF.                                              |

### M5

| Requirement                        | State   | Implementation and remaining work                                                                                             |
| ---------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| M5-FR-001 — Agent registration     | Partial | Agent owner, purpose, application, environment, tools, data, models and limits work; richer risk/identity enrollment remains. |
| M5-FR-002 — Delegation chain       | Demo    | Explicit ordered delegation is checked for grants, same application, cycles, depth and inherited tool/resource authority.     |
| M5-FR-003 — MCP registry           | Partial | Server registration and sample capability discovery work; actual MCP negotiation remains.                                     |
| M5-FR-004 — Capability filtering   | Partial | Tool grants are enforced per participating agent; live MCP capability filtering/advertisement remains.                        |
| M5-FR-005 — Tool authorization     | Demo    | Policy, application, credential expiry, server state, schema, resource, agent scope and workflow limits gate calls.           |
| M5-FR-006 — Action classification  | Demo    | READ, CREATE, UPDATE, DELETE, FINANCIAL and PRIVILEGED classifications already existed and remain supported.                  |
| M5-FR-007 — Auth brokerage         | Gap     | Actual OAuth/API-key/mTLS credential brokerage for MCP is not implemented.                                                    |
| M5-FR-008 — Payload inspection     | Demo    | Tool arguments and results receive stage-aware inspection, including redacted/withheld output with billing evidence.          |
| M5-FR-009 — Workflow limits        | Partial | Steps, duration, depth, model calls and INR cost caps work locally. Distributed counters and live agent-model binding remain. |
| M5-FR-010 — Human approval         | Demo    | Independent, expiring, exact-argument, delegation-bound approvals are consumed only by an explicit rerun.                     |
| M5-FR-011 — Tool hijacking defense | Partial | Quarantined servers and injection checks block calls; automatic capability-drift and hijack detection remain.                 |
| M5-FR-012 — A2A policy             | Partial | A2A authority is simulated through an ordered tool-call chain; remote agent protocol exchange remains.                        |
| M5-FR-013 — MCP multiplexing       | Gap     | Live MCP connection multiplexing is not implemented.                                                                          |
| M5-FR-014 — Trace correlation      | Demo    | Tool and mock model calls share a workflow ledger, authority chain and trace explorer.                                        |

### M6

| Requirement                        | State   | Implementation and remaining work                                                                                         |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| M6-FR-001 — Price catalog          | Partial | Immutable effective prices support input/output/cache/reasoning imports; custom billable units remain.                    |
| M6-FR-002 — Usage ingestion        | Demo    | Atomic normalized usage import, preview, stable external IDs, scoped attribution and invoice reconciliation work.         |
| M6-FR-003 — Hierarchical budgets   | Partial | Parent budgets and historical project attribution work; dedicated team/user/model/tool scopes remain.                     |
| M6-FR-004 — Quota types            | Partial | Spend, request, token, concurrency and workflow limits work locally; remaining enterprise quota dimensions need adapters. |
| M6-FR-005 — Threshold actions      | Demo    | Notify, throttle, alternate route, approval, block and circuit-break threshold actions work.                              |
| M6-FR-006 — Cost-aware routing     | Demo    | Eligible fallback selection considers residency, health, remaining budget and request estimates.                          |
| M6-FR-007 — Workflow accumulator   | Demo    | Agent model and tool usage accumulate on the root workflow, including billed result blocks.                               |
| M6-FR-008 — Anomaly detection      | Partial | Heuristic anomaly views and circuit limits exist; configurable anomaly rules and incident lifecycle remain.               |
| M6-FR-009 — Forecasting            | Partial | Linear projections exist; forecast confidence bands and modeled seasonality are not implemented.                          |
| M6-FR-010 — Showback/chargeback    | Partial | Allocation exports and cost-center fields work; chargeback statements and custom allocation rules remain.                 |
| M6-FR-011 — Optimization           | Gap     | A recommendation/optimization workflow is not implemented.                                                                |
| M6-FR-012 — Invoice reconciliation | Demo    | Versioned invoice adjustments preserve before/after amount, reference, reviewer reason and durable execution receipts.    |
| M6-FR-013 — Currency/tax           | Gap     | FX and tax configuration are not implemented; the ledger explicitly uses INR.                                             |
| M6-FR-014 — Auditability           | Demo    | Budget decisions, prices, imports, adjustments and administrative changes record audit metadata.                          |

### M7

| Requirement                     | State   | Implementation and remaining work                                                                           |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| M7-FR-001 — Target registration | Demo    | Campaign targets bind to existing scoped applications.                                                      |
| M7-FR-002 — Scenario library    | Partial | Named sample packs exist; a curated executable scenario library remains.                                    |
| M7-FR-003 — Campaign execution  | Partial | On-demand and scheduled sample runs work with one running job per target; safety-controlled workers remain. |
| M7-FR-004 — Agent/tool testing  | Partial | Tool/delegation paths are testable; campaign execution is synthetic, not a multistep attack runner.         |
| M7-FR-005 — Regression gates    | Partial | Passing-retest release gates work in the BFF; external CI gate APIs/webhooks remain.                        |
| M7-FR-006 — Evidence capture    | Partial | Sample findings, history and evidence exports work; real exploit capture remains.                           |
| M7-FR-007 — Re-test             | Demo    | Remediation links and deterministic retests preserve previous findings and require a passing result.        |
| M7-FR-008 — Scoring             | Partial | Sample pass/fail and severity work; formal assurance scoring and trend baselines remain.                    |

### M8

| Requirement                        | State   | Implementation and remaining work                                                                                      |
| ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| M8-FR-001 — Artifact scanning      | Partial | Artifact registration and synthetic scans work; real model/container/package scanners remain.                          |
| M8-FR-002 — SBOM/AI-BOM ingestion  | Partial | Normalized component metadata and versioned AI-BOM imports work; SPDX/CycloneDX parsers remain.                        |
| M8-FR-003 — Provenance             | Partial | Digest, publisher, license, reviewed digest and provenance history work; cryptographic verification remains.           |
| M8-FR-004 — Repository integration | Gap     | Repository hooks and automatic revision scanning are not implemented.                                                  |
| M8-FR-005 — MCP package risk       | Partial | MCP package metadata and sample findings exist; dependency vulnerability analysis remains.                             |
| M8-FR-006 — Policy gate            | Demo    | Release requires a passing retest and, when a digest is recorded, the reviewed digest.                                 |
| M8-FR-007 — Drift monitoring       | Partial | Recorded metadata changes quarantine the artifact and invalidate release/remediation; automatic drift polling remains. |
| M8-FR-008 — M1 federation          | Partial | Asset relationships and normalized imports work; automatic scanner-to-inventory federation remains.                    |

### M9

| Requirement                     | State   | Implementation and remaining work                                                                                                                           |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M9-FR-001 — SSO/federation      | Gap     | IdP settings, group mappings and the verified-identity handoff are implemented; production token verification, SSO and SCIM remain. Role preview is a demo. |
| M9-FR-002 — Workload identity   | Partial | Terraform supplies workload identity dependencies; workload authentication code remains.                                                                    |
| M9-FR-003 — RBAC/ABAC           | Partial | Eleven role previews, company memberships, delegated permission restrictions, and owner/team scoping work; authenticated ABAC remains.                      |
| M9-FR-004 — Policy-as-code      | Partial | Versioned drafts, reviews and rollback work; signed policy-as-code packages remain.                                                                         |
| M9-FR-005 — Obligations         | Partial | Runtime decisions and review conditions exist; interoperable obligation delivery/acknowledgement remains.                                                   |
| M9-FR-006 — Policy distribution | Partial | Integrity-checked bundles, simulated ack/failure/retry, expiry and stale-config denial work; actual signing/delivery remains.                               |
| M9-FR-007 — Immutable audit     | Partial | The BFF emits append-only audit rows; storage-level immutability and external integrity verification remain.                                                |
| M9-FR-008 — Retention           | Partial | Evidence holds, release, reviewed content purge and custody history work; encrypted durable retention across storage tiers remains.                         |
| M9-FR-009 — SIEM/SOAR           | Partial | Integration configuration and test acknowledgement are simulated; real SIEM/SOAR delivery remains.                                                          |
| M9-FR-010 — KMS/secrets         | Partial | Terraform provisions KMS/secret dependencies; per-service retrieval/rotation code remains.                                                                  |
| M9-FR-011 — Multi-tenancy       | Partial | Registered companies, shared memberships, reviewed defaults and locked scope overrides work; production authenticated/distributed isolation remains.        |
| M9-FR-012 — Evidence APIs       | Partial | Scoped trace/control metadata exports with SHA-256 manifests work; signed, durable evidence APIs remain.                                                    |

## Validation and deployment boundary

`tests/api/workflows.test.cjs` covers atomic/duplicate imports, price arithmetic, stale invoice edits, stage-aware dictionaries, result blocks with charges, data/delegation limits, model-call ceilings, bundle acknowledgement/expiry/drift, holds and stale purge previews, scoped evidence export, schedules/provenance and saved-workspace migration. Existing API tests retain the nine original journeys and LiteLLM receipt, residency, budget and privacy gates. `tests/e2e/workflows.cjs` drives the new forms and downloads; `tests/e2e/console.cjs` covers navigation and responsive layouts across 42 page/tab views.

The existing [Terraform dependency map](../infra/README.md) supplies the future PostgreSQL, Valkey, Kafka, object storage, KMS, identity and Kubernetes boundaries. The new prototype flows use the existing state stores and do not introduce cloud accounts or services. No Terraform apply is part of this change.

The next backend implementation should prioritize authenticated ingress and distributed state, followed by live MCP/auth brokerage, real detectors/OCR, durable policy signing/delivery and evidence retention. Caching, streaming, optimization, FX/tax, endpoint collection and scanner integrations remain explicit gaps above; broad screen coverage does not mean those services exist.

## Company configuration

The [company administration guide](company-administration.md) documents the additional onboarding, people/teams, access/identity, configuration, history/audit and provisioning flows. Settings affect backend eligibility, permissions and the console; identity delivery and infrastructure application remain explicit production integrations.

## Local evaluation release

The [demo and policy testing guide](demo-and-policy-testing.md) covers saved synthetic policy suites, comparison/regression results, isolated scenarios and validated snapshot restore. These deepen M3 explainability and M7 regression testing; curated adversarial packs and live campaign workers remain partial. Five Demo studio scenarios exercise existing model/tool paths, including fallback, budget denial, injection and expired approvals. FinOps planning, streaming, caching, OCR and expanded incident playbooks remain follow-up work.
