# Validation record — v0.4

Checked on 13 September 2026 against the local `feature/full-frontend` implementation.

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
| Terraform provider validation and mock plans | Pending; local provider cache/launch limitations |
| Docker dependency startup | Not run; Docker unavailable |
| Cloud plan/apply and production backend integration | Not run |
| GitHub CI and updated Pages publication | Blocked by automatic approval review; approval to push is required |

The API tests cover all nine workflows, exact single-use tool and budget approvals, permission and tenant restrictions, concurrency, current-period hierarchical budgets, threshold routing and notifications, timeout reconciliation, immutable drafts, canary allocation, independent review, incident evidence, workforce controls and assurance gates. The HTTP test exercises real loopback requests, versioned writes, repeat receipts, isolation, structured errors and private-source exclusion. Migration checks preserve empty tool grants, suspended agents, revoked credentials, historical unassigned spend and cancellation of old approvals.

Browser checks exercise navigation, object creation, approval review, role switching, runtime decisions, incident containment, downloads, assurance remediation, saved views, search, file/OCR simulation, persistence and mobile application creation. They use a Chromium headless shell in this workspace; this is not physical iOS/Android validation or accessibility certification. Screenshots use synthetic records created by the tests.

The final targeted API regression includes the threshold-routing and job-ID fixes. Browser results were recorded after the frontend/accessibility/file-flow changes; those later API fixes do not alter layout.

The Terraform CI workflow performs `fmt`, provider `validate`, and credential-free mocked AWS plans. It contains no `apply` step. The AWS and Kubernetes roots still require those gates and an account-specific plan before provisioning. See [infrastructure handoff](../infra/README.md).

Automatic approval review rejected pushing the implementation to `DivyanKavdia/Neurofence`, stating that implementation authorization did not establish permission to publish to that external repository. The push was not retried through another route. All implementation and reviewable changes are committed locally; the existing hosted prototype has not been updated.
