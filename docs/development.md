# Development

Run commands from the repository root with Node.js 24. There is one package install for all first-party code. Python 3.11+ and Docker are needed for LiteLLM source/runtime work; Terraform is needed only for infrastructure work.

## Choose a run mode

| Mode                                | Command                                            | State                                                    |
| ----------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Browser demo                        | `npm run dev` → port 8000                          | Browser storage; automatic rebuild, manual refresh       |
| Local HTTP API                      | `npm run mock` → port 8080                         | Files in `.runtime/data/`; rebuild/restart after changes |
| LiteLLM fixture or configured model | [Runtime setup](../integrations/litellm/README.md) | Local API plus a separate LiteLLM process                |

Run `npm ci` first. `PORT` changes the local server port. `NF_MOCK_DATA` selects another HTTP data directory. Browser and HTTP modes have separate records.

Use **Switch workspace** for company/environment and **Preview as** for a demo role. **Demo studio → Reset this demo** resets only the selected managed demo. Company membership and published defaults remain. Workspaces with live execution receipts reject demo reset.

## Make a change

| Change                                     | Files to start with                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Navigation, labels or page descriptions    | `apps/console/src/app/navigation.ts`; render routing in `Page.tsx`                       |
| Header, sidebar, tabs or mobile navigation | `apps/console/src/app/layout/`                                                           |
| Session, requests, refresh or errors       | `apps/console/src/app/useConsoleState.tsx`                                               |
| Product page or editor                     | Its folder in `apps/console/src/features/`                                               |
| Shared forms, tables or dialogs            | `apps/console/src/components/`                                                           |
| Resource fields and lifecycle              | `packages/demo-backend/src/resources/` and the corresponding editor                      |
| Company configuration or members           | `packages/demo-backend/src/company/`                                                     |
| Model/tool checks and charges              | `packages/demo-backend/src/execution/`; persistence checkpoints in `handlers/runtime.ts` |
| HTTP or provider connection                | `apps/api/src/`; transport selection in `apps/console/src/lib/api.ts`                    |

Keep each feature's components together. Split files when they own different workflows; avoid a new abstraction for a single field or trivial wrapper. Shared packages may depend on contracts, never on application code.

Use `ConsoleContext.request` and `mutate` from pages. Validate fields in the backend as well as the form. Keep capability checks, versions and idempotency on every applicable action. Put comments beside non-obvious ordering, security or data-migration rules; describe why the rule exists.

Add collections through shared contracts and the additive migration in `context.ts`. Preserve existing saved data. Update the relevant guide and `docs/openapi.json` when behavior or endpoints change. The [requirement reference](reference/requirements.md) keeps original scope IDs.

Styles load in order: `base.css` establishes the visual foundation, `console.css` adds controls and feature layouts, and `workspace.css` refines spacing, focus and lab/demo layouts. Preserve that order when moving rules. Brand assets and font notices are under `assets/brand/`.

## Test your change

Install Chromium once:

```bash
npx playwright install --with-deps chromium
```

| Command                  | Use                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `npm run typecheck`      | Strict TypeScript check                                                                    |
| `npm run build`          | Rebuild browser assets and local API bundles                                               |
| `npm run test:api`       | API behavior; build first                                                                  |
| `npm run test:browser`   | Browser workflows and layouts; build first                                                 |
| `npm test`               | Types, build, API and browser tests in order                                               |
| `npm run litellm:source` | Verify imported LiteLLM source                                                             |
| `npm run test:litellm`   | Run against the [configured fixture](../integrations/litellm/README.md#verify-the-runtime) |

Tests live in `tests/api/`, `tests/e2e/` and `tests/integration/`. Screenshots and reports go to ignored `test-results/`. `NEUROFENCE_BROWSER_PATH` selects an installed Chromium; `NEUROFENCE_SOFTWARE_RENDERING=1` supports constrained headless hosts. Infrastructure checks are in [infra/README.md](../infra/README.md#profiles-and-validation-limits).

## Publish a change

Build and commit `index.html` and `assets/console/` with source changes. Keep `.runtime/`, credentials and test output out of Git. Open a pull request and wait for the [validation workflow](../.github/workflows/validate.yml), including its committed-build check.

GitHub Pages publishes `main` from the repository root. `_config.yml` excludes source and infrastructure. Add new source roots to that exclusion list and the Pages packaging check. Do not add `.nojekyll`; the site relies on those exclusions.

## Troubleshooting

| Symptom                              | Next step                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Edit is not visible                  | Check the build output, then refresh. HTTP mode needs a rebuild/restart.                                    |
| Records differ                       | Check company, environment, role and browser versus HTTP mode.                                              |
| Save returns 409                     | Refresh the record before resubmitting a stale edit. Keep the same execution key only for the same payload. |
| Approval cannot be used              | Check reviewer, expiry, exact arguments, workflow and configuration version.                                |
| Model call returns `OUTCOME_UNKNOWN` | Reconcile the existing trace before issuing another call; see the runtime guide.                            |
| Browser cannot launch                | Install Chromium or set `NEUROFENCE_BROWSER_PATH`.                                                          |
| LiteLLM rejects a source change      | Review the vendor diff and follow the source recording steps in the runtime guide.                          |
