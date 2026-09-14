# Demo studio and policy testing

These workflows run in the browser demo and local dummy HTTP API. They use the existing inspection and runtime engines, with no provider account or cloud deployment.

## Build a repeatable company demo

1. Select **Company admin → Demo studio → Scenarios**.
2. Choose the Financial services or Software company dataset, a seed, and 0–40 synthetic requests.
3. Choose Healthy gateway, Provider outage, Exhausted budget, Blocked instruction, or Expired tool approval.
4. Confirm synthetic data and choose **Create demo environment**. The console switches to a new `Demo-*` environment within the current company.
5. Choose **Run scenario request** to inspect its mock runtime decision. Follow the trace, cost, incident or approval into the existing product screens.

The same seed repeats the generated request sequence. IDs and timestamps are new on each launch. Current company controls still apply: a stricter allowlist or an onboarding company may stop a request before the scenario's usual outcome. Software company changes sample application names; it does not publish a different company policy.

**Reset this demo** recreates the original scenario and replaces that environment's edits, activity and suites. It requires the exact environment name, a reason and the current workspace revision. Resource versions advance so an editor opened before reset cannot overwrite the new state. There is a maximum of 12 demo environments per company; reset an existing demo to reuse it.

Demo studio requires Company Admin permission. Operator access cannot create product-data scenarios. Demo studio and its environments refuse configured live-provider execution.

## Compare active and draft policy

1. Open **Guardrails → Test lab**. Simulation users manage their own suites; users with Policies permission can manage all suites in the current environment.
2. Create a suite bound to a policy. Starter cases cover a normal request, a customer identifier, an instruction override and sensitive tool output.
3. Add expected decisions and optional exact text that must be absent from output. Save only synthetic inputs.
4. Choose **Compare active and draft**. With no draft, both sides evaluate the active policy and the screen says so.
5. Review changed cases and failed expectations. A **new failure** passed the active expectations but failed them against the draft. This is an authored regression test, not an assurance certification.
6. Filter cases, inspect both outputs, export the comparison or select an older run. Suite, policy, detector or company configuration changes mark prior results as historical.

Comparisons never publish policy, invoke a model, reserve a budget or create traffic. They use the same deterministic inspection engine as the gateway, including mandatory company controls. The baseline is the policy's current published fields; this does not simulate canary traffic allocation.

Limits: 12 suites per environment, 1–30 cases per suite, 8,000 characters per input and 24,000 input characters per suite. The most recent 20 runs are retained across the environment. Output previews show at most 500 characters; exclusions inspect the complete result. Inputs and previews are deliberately retained as synthetic test data, separate from runtime raw-content retention.

**Export inputs** and **Import test inputs** transfer editable definitions. Imported inputs require review and synthetic-data confirmation before saving; the backend validates them again. A stale edit returns a conflict and keeps the form inputs available for correction or download.

## Save and restore a demo

Use **Demo studio → Backup & restore → Download demo snapshot** in a managed demo. Snapshots include resource configuration, sample activity and suite inputs. Membership, company configuration, audit history, jobs, policy-distribution authority, credentials and previous test results are excluded. Credential references become dummy references; approval records are cancelled and lose execution fingerprints.

Select a JSON snapshot and review its validated preview. Checksum, company ownership, shape, resource bindings, budget cycles and size are checked again when restoring. Restore creates a new environment and assigns sample resources and suites to the restoring administrator. Existing environments are preserved. Current company configuration applies; the preview highlights if it changed since export.

The format is `neurofence-demo`, schema 1, with a SHA-256 digest of recursively key-sorted compact JSON. A checksum detects corruption; it does not authenticate the author. Export is limited to 750 KB of UTF-8 JSON and import to 800 KB, below the HTTP API's 1 MB request boundary. Use only synthetic inputs and activity in these snapshots.

## Implementation and verification

| Location                                                        | Responsibility                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/contracts/src/policy-lab.ts`, `demo.ts`               | Suite, comparison, scenario and snapshot contracts                 |
| `packages/demo-backend/src/workflows/policy-lab.ts`             | Validation, owner scope, versions and comparisons                  |
| `packages/demo-backend/src/workflows/demo.ts`, `demo-backup.ts` | Scenario creation/reset, snapshots and isolated restore            |
| `apps/console/src/features/guardrails/PolicyLab.tsx`            | Suite editor, imports, comparisons and history                     |
| `apps/console/src/features/demo/DemoStudio.tsx`                 | Scenario setup, execution and snapshots                            |
| `apps/console/src/styles/workspace.css`                         | Shared spacing, readable controls, mobile layouts and focus styles |

Browser writes use an origin-wide Web Lock when supported. A storage-event notice prompts other tabs to refresh; versions reject stale edits. Browsers without Web Locks retain a per-instance queue and need a single editing tab. The file-backed API requires one server process.

`tests/api/labs.test.cjs` covers isolation, comparison behavior, integrity failures, reset and live-provider boundaries. `tests/e2e/labs.cjs` covers the full browser flow, downloads, tampered imports, two-tab conflicts, focus return and mobile layouts. Existing suites check the other product flows. These checks support the accessibility target; they are not a WCAG certification.

This release implements the first three agreed priorities. FinOps scenario planning, PDF/SBOM parsing, streaming/cache simulations and expanded incident playbooks remain follow-up work.
