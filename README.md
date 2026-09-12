# NeuralFence prototype

Working HTML wireframe for the enterprise AI trust workspace in this repository, **Neurofence**. It connects model access, guardrails, agent tool approvals, budgets, incidents and audit evidence through shared demo state.

![Command center](docs/screenshots/command-center.jpg)

## Open the prototype

**[Open NeuralFence](https://divyankavdia.github.io/Neurofence/)** on desktop or mobile.

The interface uses a neural shield logo, graphite and mint colors, embedded Manrope typography, actionable dashboard metrics, and nine guided journeys. On mobile, a bottom navigation bar, labeled data cards and review sheets make the same workflows usable by touch.

Version 0.3 adds application editing, agent tool permissions and a complete incident review loop. Edit existing records, verify the next request uses the new configuration, assign findings, save investigation notes, resolve or reopen incidents, and export the linked evidence.

Use **Explore workflows** to choose a journey and its demo role. Screen links are shareable, and browser back/forward navigation restores the selected view.

Download or clone this repository, then open **`index.html`** in a browser. The application has no build step, runtime dependencies or external network calls.

```bash
git clone https://github.com/DivyanKavdia/Neurofence.git
cd Neurofence
```

To serve it locally with Python 3:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://localhost:8000>. The GitHub repository view displays source code; it is not a running application.

## Test on a phone

Open **<https://divyankavdia.github.io/Neurofence/>** in Safari or Chrome on your phone. Use **Home**, **Gateway**, **Agents**, **Review**, or **More** in the bottom navigation. No local server is needed for the hosted version.

For local development, run the server from this repository on your computer:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Connect the phone to the same Wi-Fi, then open `http://COMPUTER-IP:8000` in Safari or Chrome. Replace `COMPUTER-IP` with your computer's local Wi-Fi IP address. Keep the server running while testing; press Ctrl+C to stop it. On Windows, use `py -3` if `python3` is unavailable.

## Publish on GitHub Pages

GitHub Pages publishes **`main` → `/ (root)`**. The root `index.html` is the application entry point; `.nojekyll` lets Pages serve the files without a Jekyll build.

Pushes to `main` publish automatically. Check the **pages build and deployment** run in [Actions](https://github.com/DivyanKavdia/Neurofence/actions). Publishing configuration is available in [Settings → Pages](https://github.com/DivyanKavdia/Neurofence/settings/pages).

## Try the connected workflows

| Journey | Starting point | What to try |
| --- | --- | --- |
| Governed model request | AI gateway → Playground | Run the safe, sensitive-data and prompt-injection examples. Inspect the decision, execution stages and cost. |
| Human tool approval | Agents & MCP → Tool playground | Request `vendor.updateBankAccount` as Platform admin. Switch to Security admin to approve it with a reason, then explicitly rerun the exact request. |
| Policy lifecycle | Guardrails → Policy builder | As Security admin, save a draft, test it in Simulator, publish it and restore an earlier configuration. |
| Budget enforcement | FinOps → Budget hierarchy | Lower the workspace or application hard limit and rerun a request. Every applicable parent budget is checked. |
| Application lifecycle | AI gateway → Applications & keys | Open an application and select **Edit application**. Update its name, owner, route or budget, then run a new request. Historical spend stays with its recorded budget. |
| Agent permissions | Agents & MCP → Agents | Open an agent and select **Edit agent**. Change its purpose, application, step limit and permitted tools. Remove a grant and verify that the next call is denied. |
| Incident response | Incidents | As Security admin, assign an owner and **Save review** to record notes. Contain its agent, resolve with a reason, reopen for follow-up, and **Export evidence**. |
| Evidence | AI gateway → Traces; Governance → Audit trail | Follow the recorded decisions and export JSON evidence. |

The role selector is a **role preview**. Pending or denied tool requests stop before execution. Approvals are tied to the exact agent, tool, arguments, workflow and policy version, and are consumed once. Publishing a policy invalidates outstanding approvals. Changes to agent access, application access bindings or agent containment also cancel unused approvals and start a new demo workflow.

Platform admins edit applications and agents. Developers edit their own agents within their own applications. Security admins review incidents and control containment; Auditors inspect and export evidence. An agent with no selected tools cannot execute any tool. Global blocks and financial resource restrictions still apply to selected tools. Reopening an incident retains the agent's containment state.

Changes are stored in the browser's local storage. Use **Reset demo** to restore the sample state. Different devices, browsers and web addresses keep separate demo data.

## Screens

The prototype contains 10 navigation areas and 26 main page/tab views, plus workflow dialogs.

- [Model request playground](docs/screenshots/model-playground.jpg)
- [Mobile tool approval](docs/screenshots/mobile-tool-approval.jpg)
- [Command center](docs/screenshots/command-center.jpg)
- [Mobile command center](docs/screenshots/mobile-command-center.jpg)
- [Application editor](docs/screenshots/application-editor.jpg)
- [Agent permissions editor](docs/screenshots/agent-editor.jpg)
- [Incident review](docs/screenshots/incident-review.jpg)
- [Mobile incident review](docs/screenshots/mobile-incident-review.jpg)
- [Logo and brand assets](assets/brand/README.md)

## Browser checks

The three browser suites cover navigation, role restrictions, model decisions, scope checks, approval consumption, policy publication and rollback, budgets, containment, exports and persistence. Extended journeys cover creating and pausing providers, routing fallback, credential rotation, agent registration and workflow caps, settings, workforce controls, review sheets and browser history. Lifecycle checks cover saved-data migration, editing, historical budget attribution, permission revocation, cancellation of stale approvals, incident assignment, notes, resolution, reopening and linked evidence export.

Layout checks exercise all 26 views at 320px, 390px, 768px and 1440px. Mobile checks use touch emulation; they do not replace testing on physical iOS and Android devices.

Requires Node.js 20 or later:

```bash
npm ci
npx playwright install chromium
npm test
```

Results and screenshots are written to `test-results/`, which is excluded from Git. On Linux CI, `npx playwright install --with-deps chromium` installs the required browser system packages as well.

To use an already installed Chromium executable, set `NEUROFENCE_BROWSER_PATH`. `NEUROFENCE_SOFTWARE_RENDERING=1` enables the graphics flags used by the constrained headless validation environment.

## Project files

| Path | Purpose |
| --- | --- |
| `index.html` | Complete responsive app, inline styles, demo state and interaction handlers |
| `.nojekyll` | Direct static publishing on GitHub Pages |
| `tests/prototype.cjs` | Portable browser regression checks |
| `tests/experience.cjs` | Connected creation/editing journeys, history and responsive layout checks |
| `tests/lifecycle.cjs` | Application/agent editing, data migration, permission changes and incident review |
| `assets/brand/` | Reusable SVG marks, outlined wordmarks, embedded font source and license |
| `docs/screenshots/` | Selected desktop and mobile JPG previews |
| `package.json`, `package-lock.json` | Development test dependency and commands |

## Current implementation boundary

This is a browser prototype using synthetic data and deterministic example checks. Provider responses, tool execution, credentials, role authorization, budget reservations and audit evidence are simulated. There is no backend, production detector, live provider connection, signed audit store or server-side retention enforcement.

The existing browser storage key is retained, preserving saved demo records. The v0.3 update adds explicit tool grants to older agents. New requests record their budget scope at request time. Older traces without a saved budget scope are attributed once using their saved application's current binding and are labeled accordingly in trace details and exports; earlier budget changes cannot be reconstructed. Use **Reset demo** to begin from the original fixture.
