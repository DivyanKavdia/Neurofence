# Product scope

This is a working prototype for the nine Native Gateway product modules. The console, review flows and dummy state are usable now. External services are implemented only where explicitly noted below.

## What you can exercise

| Area                         | Working behavior                                                                                           | Main remaining integration                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Company administration       | Onboarding, people/teams, permissions, reviewed settings, inheritance and provisioning requests            | Verified identity, SSO/SCIM and actual provisioning                                |
| Demo studio                  | Seeded scenarios, run/reset, snapshot validation and restore into a new environment                        | Local evaluation only                                                              |
| Command center and inventory | Activity summary, asset relationships, imports, AI-BOM snapshots and configurable risk                     | Automatic discovery, inventory connectors and live posture                         |
| Workforce AI                 | Sample activity, instance rules, coaching, controls and exceptions                                         | Browser/endpoint collectors and inline enforcement                                 |
| AI gateway                   | Provider/model configuration, routes, application keys, playground and traces; optional LiteLLM text calls | Production ingress/auth, streaming, caching, live discovery and distributed limits |
| Guardrails                   | Pattern/dictionary inspection, policy lifecycle, simulator and saved active/draft test suites              | Production classifiers, OCR and reversible tokenization                            |
| Agents & MCP                 | Registration, delegation, tool permissions, exact-request approval and sample execution                    | Live MCP transport, upstream authentication and credential brokerage               |
| FinOps                       | Hierarchical budgets, attributed ledger, forecasts, price/usage imports and invoice adjustments            | Shared reservations, provider invoices, FX/tax and optimization                    |
| Incidents                    | Investigation, notes, assignment, containment, resolution and evidence export                              | Live incident ingestion and external response delivery                             |
| Assurance                    | Sample campaigns/scans, schedules, findings, remediation, retest and provenance gates                      | Real scanners, adversarial packs and durable workers                               |
| Governance                   | Approvals, exceptions, holds/purge, control mappings and policy bundle acknowledgements                    | Signed distribution, immutable evidence storage and SIEM/SOAR delivery             |

Use [company administration](company-administration.md) and [demo/policy testing](demo-and-policy-testing.md) for walkthroughs. The [requirement reference](reference/requirements.md) retains the original M1–M9 IDs and detailed gaps.

## Flows worth preserving

| Flow                            | Expected outcome                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Provider → model → application  | Validate/discover, approve the model, bind route/policy/budget, issue a demo key, inspect a request and its cost          |
| Policy or company configuration | Save draft, validate/simulate, independently review, publish; rollback creates another reviewed version                   |
| Agent → tool                    | Check delegation and scope; obtain approval for the exact request; rerun explicitly and consume it once                   |
| Budget control                  | Apply parent and application limits before execution; keep incurred costs when a response is blocked                      |
| Incident → evidence             | Investigate, contain or revoke, resolve/reopen, then export evidence; content purge retains accounting and audit metadata |
| Assurance → release             | Record findings, link remediation, retest and release; changed provenance invalidates prior approval                      |
| Demo evaluation                 | Create an isolated scenario, compare policy inputs, export/restore, and reset without replacing the source workspace      |

## Simulation details that matter

- **Identity:** role switching previews permissions. Demo headers and virtual keys do not provide production authentication.
- **Models:** the browser returns synthetic responses. The optional LiteLLM fixture runs the actual proxy with a fixed response; configured live mode can call a provider.
- **Inspection:** detectors use patterns and literal dictionaries. PDF/image input uses a labeled extraction fixture; it does not parse arbitrary documents.
- **Tools and assurance:** decisions and lifecycle rules run, but tool calls, scans, collectors and scheduled workers are simulated.
- **Integrity:** exports and bundles have SHA-256 checksums, not signatures. Appending audit records in a demo store is not immutable storage.
- **Costs:** sample and configured rates use INR. Forecasts are heuristic; provider-charge retrieval and currency conversion are not automatic.
- **Exceptions:** free-form approval records a review; it does not bypass runtime controls. Tool and budget execution approvals have explicit bindings.

Tests cover API behavior, browser flows and responsive layouts. They do not certify production readiness or physical-device accessibility. [Handover](handover.md#suggested-backend-order) gives the recommended implementation sequence.
