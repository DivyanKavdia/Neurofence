# Working on Neurofence

Run commands from the repository root. Use Node.js 24 and `npm ci`; there are no separate installs for `apps/` or `packages/`. Python 3.11+ is needed for LiteLLM source checks. Docker is needed only for runtime/dependency containers, and Terraform only for infrastructure work.

## Daily workflow

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:8000`. The development command builds the console and local API, watches their source files and serves only public frontend artifacts. Refresh after edits; browser state survives a refresh. This is automatic rebuilding, not hot module replacement. Press Ctrl+C to stop the server and watcher.

For file-backed state over HTTP, use `npm run mock` and open `http://127.0.0.1:8080`. This command builds once and starts the local API. Restart it after API changes. `PORT` changes either server's port; `NF_MOCK_DATA` selects a separate API data directory. The default is `.runtime/data/`. The browser and HTTP modes have separate records.

Use the console profile menu to switch role, user, tenant or environment. Independent approvals require another reviewer when four-eyes review is enabled. **Reset demo** resets the selected workspace; receipt-bearing LiteLLM workspaces retain their execution history and reject reset.

## Find the code for a change

| Change | Start here |
| --- | --- |
| Add a navigation entry or page | `apps/console/src/app/navigation.ts`, then `app/Page.tsx` and the relevant `features/` directory |
| Edit a gateway, budget, workforce or governance page | Its named component under `apps/console/src/features/` |
| Change common resource forms or details | `features/catalog/fields.tsx`, `Editor.tsx`, `ResourceDetail.tsx` |
| Change table behavior, validation controls or dialogs | `apps/console/src/components/` |
| Change application state, session or mutation handling | `apps/console/src/app/App.tsx` and `ConsoleContext.tsx` |
| Change API selection or browser HTTP behavior | `apps/console/src/lib/api.ts` |
| Add a resource field/action | Shared `types.ts`; demo `resources/schema.ts`, `validate.ts`, and the relevant handler; then `docs/openapi.json` |
| Change approvals, incidents or runtime request orchestration | `packages/demo-backend/src/handlers/` |
| Change model/tool enforcement, quotas or sample jobs | `packages/demo-backend/src/execution/` |
| Change sample records or migration | `packages/demo-backend/src/fixtures/` and `stores/` |
| Change HTTP persistence or provider integration | `apps/api/src/storage/` or `providers/` |
| Update LiteLLM source/dependencies | [Runtime maintenance guide](../integrations/litellm/README.md) |
| Add a future backend dependency | [Infrastructure guide](../infra/README.md) |

Use the existing shared controls so capability checks, errors, focus handling and mobile behavior remain consistent. Feature code calls the context transport rather than editing fixture state directly. Validate new fields in the backend as well as the editor. Preserve request keys, versions, audit history and exact approval binding when adding actions.

## Verify a change

Install the browser once:

```bash
npx playwright install --with-deps chromium
```

| Command | Checks |
| --- | --- |
| `npm run typecheck` | Strict TypeScript across apps and shared packages |
| `npm run build` | Rebuilds the committed console and ignored local API bundles |
| `npm run test:api` | API workflows, HTTP persistence/isolation and provider contract regressions; build first |
| `npm run test:browser` | Console workflows, forms, role switching and layouts; build first |
| `npm test` | Types, build, API contracts and browser workflows in order |
| `npm run litellm:source` | Imported source integrity and local patch count |
| `npm run test:litellm` | Complete HTTP API → actual LiteLLM fixture, when configured as below |

Tests are grouped into `tests/api/`, `tests/e2e/` and `tests/integration/`. Browser results and screenshots go to `test-results/`. The browser suite covers all 36 page/tab views at 320, 390, 768 and 1440 pixels, plus the main workflows. `NEUROFENCE_BROWSER_PATH` selects an installed Chromium; `NEUROFENCE_SOFTWARE_RENDERING=1` supports constrained headless environments.

For provider/runtime changes, follow the [LiteLLM fixture guide](../integrations/litellm/README.md#verify-the-runtime). For infrastructure changes, run the commands in [infrastructure validation](../infra/README.md#profiles-and-validation-limits). The GitHub workflow also builds the real runtime container and checks Pages packaging. Cloud apply and paid model calls are outside these tests.

## Build and publish

`npm run build` writes `index.html` and hashed files in `assets/console/`; commit those outputs with frontend changes. `.runtime/backend.cjs`, `.runtime/mock-server.cjs` and `.runtime/gateway.cjs` are local generated entry points and remain ignored. Brand assets live in `assets/brand/`; see its [guide](../assets/brand/README.md) before changing identity assets.

Run the relevant checks before opening a pull request. The [validation workflow](../.github/workflows/validate.yml) checks types, API/browser workflows, a reproducible committed build, the LiteLLM container, Terraform and site exclusions. GitHub Pages publishes from `main` at the repository root using `_config.yml`. New source directories must be excluded there and in the packaging checks. Do not add a `.nojekyll` file: this repository relies on Jekyll exclusions to keep source out of the site.

Use [GitHub Actions](https://github.com/DivyanKavdia/Neurofence/actions/workflows/validate.yml) and pull request history for run results. Documentation describes how the current system works, rather than keeping duplicate release-by-release validation logs.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| My edit is not visible | Refresh after the watch build. With `npm run mock`, rebuild/restart the API. Check the terminal for build errors. |
| Records differ between tabs or modes | Check tenant, environment, user/role and whether the page uses browser or HTTP storage. |
| A mutation returns 409 | Reload the record before retrying a stale version. Reuse an execution key only for the identical payload. |
| An approval cannot be used | Check reviewer, expiry, exact arguments, workflow and configuration version. Access changes cancel unused approvals. |
| A live call reports `OUTCOME_UNKNOWN` | Reconcile the existing trace against provider records before starting another call. See the runtime guide. |
| LiteLLM refuses to start after a source edit | Review the vendor diff, record the intentional change and run the source/runtime checks. |
| Browser launch fails | Install Playwright Chromium or set the browser path described above. |
