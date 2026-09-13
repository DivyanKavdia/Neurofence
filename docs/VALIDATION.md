# Validation record — v0.5

Checked on 13 September 2026 for the optional LiteLLM integration.

| Check | Result |
| --- | --- |
| Strict TypeScript and reproducible static/server builds | Passed locally; GitHub CI pending |
| API/HTTP and LiteLLM contract tests | 22 passed |
| Existing browser workflows and responsive layouts | 75 passed |
| Full NeuralFence HTTP BFF → LiteLLM v1.100.1 fixture | Passed locally with reported usage, request/response checks and replay protection |
| Mobile playground through the actual LiteLLM fixture | Passed at 390 px with no JavaScript errors |
| Metadata-only persistence and interrupted execution receipts | Passed |
| Source revision and image pin | Source gitlink verified; image digest resolved from upstream registry |
| Terraform formatting and configuration syntax | Passed locally; updated provider validation/mock plans pending CI |
| Hardened Compose container fixture | Configured as a GitHub CI gate; pending |
| Fork-source Docker build, enabled cloud plan/apply, paid provider calls | Not run |
| GitHub LiteLLM fork | Pending creation; connector lacks the fork operation |

The actual proxy test used the pinned Python LiteLLM release with a server-configured fixture response, so no provider credentials or paid inference were needed. It is distinct from the HTTP contract tests, which use a local protocol fixture. GitHub CI additionally exercises the digest-pinned container with the same restrictions as the optional Kubernetes workload.

The integration guide documents the source/fork workflow, server-only configuration, current prototype boundaries and provisioning sequence. Existing public Pages continues using the browser mock.

## Previous release — v0.4

Checked on 13 September 2026 against the `feature/full-frontend` implementation, including GitHub CI on commit `17f8288546a2ac728849e53fe01454103aa56b80`.

| Check | Result |
| --- | --- |
| Strict TypeScript compilation | Passed |
| Production static build and optional HTTP-server build | Passed |
| Stateful BFF and HTTP adapter tests | 15 passed |
| Browser workflow and layout checks | 75 passed |
| Responsive coverage | All 36 page/tab views at 320, 390, 768 and 1440 pixels |
| Visual review | Desktop command center and mobile tool playground screenshots inspected |
| Terraform HCL formatting/syntax | Passed |
| Local dependency YAML and OpenAPI JSON parsing | Passed |
| Terraform provider initialization and validation | Both AWS and platform roots passed in GitHub CI |
| Terraform AWS mock plans | Both profiles passed; 2 passed, 0 failed |
| Docker dependency startup | Not run; Docker unavailable |
| Cloud plan/apply and production backend integration | Not run |
| GitHub frontend CI | Passed: strict types, build, 15 API/HTTP tests, 75 browser checks and identical committed static output |
| GitHub Pages publication | Published from the checked static build after merge to `main` |

The API tests cover all nine workflows, exact single-use tool and budget approvals, permission and tenant restrictions, concurrency, current-period hierarchical budgets, threshold routing and notifications, timeout reconciliation, immutable drafts, canary allocation, independent review, incident evidence, workforce controls and assurance gates. The HTTP test exercises real loopback requests, versioned writes, repeat receipts, isolation, structured errors and private-source exclusion. Migration checks preserve empty tool grants, suspended agents, revoked credentials, historical unassigned spend and cancellation of old approvals.

Browser checks exercise navigation, object creation, approval review, role switching, runtime decisions, incident containment, downloads, assurance remediation, saved views, search, file/OCR simulation, persistence and mobile application creation. They passed with a Chromium headless shell locally and with Playwright Chromium in GitHub CI; this is not physical iOS/Android validation or accessibility certification. Screenshots use synthetic records created by the tests.

The full local suite was rerun from the recovered publication checkout. A clean dependency install reproduces the committed static build. The published Git tree matches the verified local snapshot.

The Terraform CI workflow performs `fmt`, locked-provider initialization, provider `validate`, and credential-free mocked AWS plans. It contains no `apply` step. These gates passed in [GitHub CI](https://github.com/DivyanKavdia/Neurofence/actions/runs/34743454348). The AWS and Kubernetes roots still require an account-specific plan before provisioning. See [infrastructure handoff](../infra/README.md).

Publication is authorized. [Pull request #1](https://github.com/DivyanKavdia/Neurofence/pull/1) contains the implementation and validation history. The [live console](https://divyankavdia.github.io/Neurofence/) uses synthetic browser data; it does not connect to a provisioned cloud backend.
