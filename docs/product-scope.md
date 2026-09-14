# Frontend scope and acceptance map

Implementation baseline: **Enterprise_AI_Trust_Fabric_UI_UX_Functional_Design_v1.docx**, the Native Gateway v2 canonical coding context and the v2 low-level engineering design supplied for this project. This is the frontend plus a stateful demo backend, with optional LiteLLM text-model execution through the local API. See [feature coverage](feature-coverage.md) for the requirement-level audit and remaining work. All nine product modules are represented through 10 navigation areas, 42 page/tab views, and their detail/editor/review flows.

The 25 primary screens from the UI specification map as follows. API paths below are the implemented BFF paths; some aggregate endpoints deliberately consolidate the service-oriented names in the source design.

| #   | Required screen                         | Entry in console                                | Working flow / BFF ownership                                                                                                       |
| --- | --------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Command Center                          | Command center                                  | KPI pivots, incident action queue, dependency health; `/workspace`, `/health`                                                      |
| 2   | AI Inventory                            | AI inventory → Inventory / Relationships        | Search/filter/sort, columns, saved views, export, asset creation; `/assets`                                                        |
| 3   | Asset Detail & AI-BOM                   | Open an asset                                   | Owner/risk/coverage, relationships, snapshots and diff, exceptions; `/assets/{id}`                                                 |
| 4   | Workforce / Shadow AI                   | Workforce AI → Activity / Policies              | Account/device/activity detail, coach/justify/redact/block, future-event policies, exceptions; `/workforce`, `/workforcePolicies`  |
| 5   | Provider & Model Catalog                | AI gateway → Providers & models / Model catalog | Connector health, model pricing/region/capabilities, approve deployments; `/providers`, `/models`                                  |
| 6   | Provider Connection Wizard              | Add provider → connection detail                | Secret reference, validate, discover, approve model, publish catalog; provider actions                                             |
| 7   | AI Gateway Overview                     | AI gateway → Overview                           | Requests, latency, errors, cost, mix and trace pivots; aggregate BFF reads                                                         |
| 8   | Route Builder                           | AI gateway → Routes → Add/open route            | Alias, primary/fallback, budget threshold, residency, retries, visual graph, version lifecycle; `/routes`                          |
| 9   | Virtual Credentials & Projects          | AI gateway → Applications & keys                | Bind route/policy/budget, issue once, rotate/revoke, copy example, test; `/projects`                                               |
| 10  | Runtime Trace Explorer                  | AI gateway → Traces / Playground                | Request stages, classifications, identity, policy version, cost, replay, export, audited reveal; `/traces`, `/runtime/model`       |
| 11  | Guardrails Overview                     | Guardrails → Overview / Detectors               | Decisions, detector health/status, policy coverage; `/detectors`                                                                   |
| 12  | Guardrail Policy Builder                | Guardrails → Policy builder                     | Ordered detector pipeline, request/response actions, streaming configuration, version diff/lifecycle; `/policies`                  |
| 13  | Guardrail Simulator                     | Guardrails → Simulator                          | Active/draft text and file-text samples, request/response/tool stage, result; `/inspect`                                           |
| 14  | Agents Inventory                        | Agents & MCP → Agents                           | Register/edit owner, purpose, application, environment, tool/data scope; `/agents`                                                 |
| 15  | Agent Detail & Delegation               | Open an agent                                   | Delegation, grants, application policy/budget, steps/duration/depth, runs, containment; agent actions                              |
| 16  | MCP Catalog                             | Agents & MCP → MCP catalog                      | Server registration, transport/auth references, tool/resource/prompt metadata and discovery; `/servers`, `/tools`                  |
| 17  | MCP Tool Detail & Approval              | Tool permissions → tool; Governance → Approvals | Schema/action/resource/expiry review, exact arguments, independent decision; tool/approval actions                                 |
| 18  | Agent/MCP Runtime Trace                 | Agents & MCP → Tool playground / Tool traces    | READ/UPDATE/DELETE outcomes, auth-broker stages, exact single-use approval, workflow circuit breaking; `/runtime/tool`             |
| 19  | FinOps Overview                         | FinOps → Overview / Forecast & anomalies        | Spend, reservations, projected spend, allocation export, trace pivots; shared cost ledger                                          |
| 20  | Budget Hierarchy                        | FinOps → Budget hierarchy                       | Recursive parent tree, current-period attributed spend, scope navigation; `/budgets`                                               |
| 21  | Budget & Quota Editor                   | Add/open budget                                 | Period, INR limits, hard/soft, quotas, threshold actions/fallback, independent publication; budget lifecycle                       |
| 22  | Incidents & Findings                    | Incidents                                       | Cross-module queue, filtering, selection and bulk review; `/incidents`                                                             |
| 23  | Incident Investigation                  | Open incident                                   | Notes/assignment, trace, contain/revoke, exception, resolve/reopen, evidence; incident actions                                     |
| 24  | Assurance Center                        | Assurance → Red team / Supply chain             | Targets, test pack/artifact/provenance, job progress, findings, remediation, retest, release gate; `/campaigns`, `/scans`, `/jobs` |
| 25  | Governance, Compliance & Administration | Governance → ten tabs                           | Approvals, exceptions, evidence export, audit, integrations, members, entitlements, deployment/retention settings, role matrix     |

## Nine end-to-end journeys

Use **Explore workflows** for entry points and suggested roles. API tests exercise all nine workflows, and browser tests drive their primary happy paths through actual forms and dialogs.

| Workflow                   | Implemented closure                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| WF-01 provider onboarding  | Validated secret reference → discovered deployment → model approval → published catalog                                    |
| WF-02 governed application | Route/policy/budget binding → issued virtual key → allowed/redacted/denied request → trace/cost                            |
| WF-03 policy lifecycle     | Immutable active fields → draft → simulation → independent approval → 10% canary/promotion → rollback                      |
| WF-04 agent registration   | Owner/purpose/data and tool grants → application budget/policy inheritance → workflow caps → governed call                 |
| WF-05 MCP approval         | Action/resource/parameter/expiry checks → independent exact request decision → explicit rerun → single-use consumption     |
| WF-06 budgets              | Parent-child binding → draft/review/publication → period/quota checks → notify/throttle/route/approval/block/circuit break |
| WF-07 incident response    | Trace investigation → assignment/notes → containment or credential revocation → resolve/reopen → evidence export           |
| WF-08 Shadow AI            | Simulated event → account/activity policy → coaching/control review → time-bound exception approval                        |
| WF-09 assurance            | Campaign/scan → failed findings → linked remediation → passing sample retest → released gate                               |

## Shared behavior

- Eleven role previews, registered company/environment boundaries and module visibility. Company admin and Neurofence operator have separate responsibilities. Profile switching provides a second reviewer for four-eyes checks. Demo identity switching is not real authentication.
- Loading, retryable errors, empty states, inline validation, global search, hash links/history, saved table views, sorting, pagination, exports and keyboard focus management.
- Sensitive content is masked by default. Retained content requires an explicit setting and a separately audited reveal action. Secrets are references; generated virtual keys are shown only at issuance.
- Mutations carry idempotency keys and record versions. Concurrent mock runtime requests are serialized before reservations and cost commitment. Changed permissions/configuration invalidate unused approvals.
- Long jobs expose IDs and progress through polling. Uncertain timeout charges remain reserved until reconciliation. Historical cost stays on the scope recorded with the request.
- Desktop and mobile layouts are checked at 320, 390, 768 and 1440 pixels. This is browser testing, not a WCAG certification or physical-device test.

## Deliberate simulation boundaries

Provider onboarding/health/discovery, default responses, credentials, tool execution/auth brokerage, workforce collection and assurance scans are synthetic. Risk scoring is deterministic and configurable; forecasts remain heuristic. Evidence exports and policy bundles have actual SHA-256 integrity hashes but no signatures. Detectors use patterns and literal dictionaries. The simulator imports text and accepts PDF/image files using a labeled OCR fixture; real extraction and scanner execution belong to future backend adapters. Independent review and canary behavior run against mock state; there are no cryptographically signed bundles. A canary uses deterministic request allocation for policies/routes/budgets. The sample cost ledger uses INR and representative prices, not live exchange rates.

Free-form exception approval records review evidence; it does not automatically bypass runtime controls. MCP and budget execution approvals have explicit request fingerprints and enforceable single-use behavior. The local LiteLLM path persists model execution receipts and inspects actual text responses. Production auth, distributed transactions and reservations, durable shared receipts, automated provider-charge retrieval, durable storage retention, real event streams and package/model verification remain backend work. See the [architecture](architecture.md) for the runtime boundary.

Invoice adjustments, evidence holds and reviewed trace-content purges now run against the shared demo store. Purging preserves ledger/receipt/audit metadata. Scheduled campaigns run on polling, and policy bundle acknowledgement enforcement is activated by building the first bundle.

The browser uses a scoped aggregate read for the finite demo dataset; the BFF also exposes filtered/sorted/cursor list endpoints for the production adapter. See [API handoff](api.md) and [infrastructure instructions](../infra/README.md).

## Company administration extension

Six company administration views add onboarding, company overview, memberships/teams, versioned configuration and effective overrides, delegated permissions/identity, history/audit, and provisioning requests. These complement the original source screens. See [company administration](company-administration.md) for the complete flow and production boundaries.

## Repeatable evaluation extension

**Demo studio** adds Scenarios and Backup & restore views for managed `Demo-*` environments. **Guardrails → Test lab** adds saved inputs, expected decisions, active/draft comparisons, history and exports. The shared interface uses tighter spacing, contextual descriptions, clearer controls, focus restoration and cross-tab change notices. See [demo and policy testing](demo-and-policy-testing.md).
