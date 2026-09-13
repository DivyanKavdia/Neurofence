const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../..");
const results = path.join(root, "test-results");
fs.mkdirSync(results, { recursive: true });
const screens = {
  "Command center": [],
  "AI inventory": ["Inventory", "Relationships"],
  "Workforce AI": ["Activity", "Policies"],
  "AI gateway": [
    "Overview",
    "Providers & models",
    "Model catalog",
    "Routes",
    "Applications & keys",
    "Traces",
    "Playground",
  ],
  Guardrails: ["Overview", "Policy builder", "Simulator", "Detectors"],
  "Agents & MCP": [
    "Agents",
    "MCP catalog",
    "Tool permissions",
    "Tool playground",
    "Tool traces",
  ],
  FinOps: [
    "Overview",
    "Budget hierarchy",
    "Usage ledger",
    "Forecast & anomalies",
  ],
  Incidents: [],
  Assurance: ["Red team", "Supply chain"],
  Governance: [
    "Approvals",
    "Exceptions",
    "Evidence & compliance",
    "Audit trail",
    "Integrations",
    "Members",
    "Settings",
    "Roles",
  ],
};
let browser;
const checks = [],
  errors = [];
const check = (condition, label) => {
  assert.ok(condition, label);
  checks.push(label);
};
(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.NEUROFENCE_BROWSER_PATH
      ? { executablePath: process.env.NEUROFENCE_BROWSER_PATH }
      : {}),
    args:
      process.env.NEUROFENCE_SOFTWARE_RENDERING === "1"
        ? [
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--use-gl=disabled",
          ]
        : [],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  const state = () =>
    page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("neuralfence.console.v2.acme:Development"),
      ),
    );
  const ready = () => page.locator('#main[aria-busy="false"]').waitFor();
  const nav = async (name, tab) => {
    if (
      await page
        .locator("#sidebar")
        .evaluate((e) => e.getBoundingClientRect().x < 0)
    )
      await page
        .getByRole("button", { name: "More navigation", exact: true })
        .click();
    await page
      .locator("#sidebar")
      .getByRole("button", { name: new RegExp("^" + name) })
      .click();
    if (tab) await page.getByRole("tab", { name: tab, exact: true }).click();
    await ready();
  };
  const role = async (name) => {
    await page.getByLabel("Role preview", { exact: true }).selectOption(name);
    await page.waitForTimeout(120);
    await ready();
  };
  const click = async (name) => {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(210);
    await ready();
  };
  const close = async () => {
    if (await page.getByRole("dialog").count())
      await page.getByLabel("Close dialog", { exact: true }).click();
  };
  const open = async (name) => click(`Open ${name}`);
  const form = async (values) => {
    for (const [name, value] of Object.entries(values)) {
      const locator = page
        .getByRole("dialog")
        .getByLabel(name, { exact: false });
      const tag = await locator.evaluate((e) => e.tagName);
      if (tag === "SELECT") await locator.selectOption(value);
      else await locator.fill(String(value));
    }
  };
  await page.goto(pathToFileURL(path.join(root, "index.html")).href);
  await ready();
  for (const [name, tabs] of Object.entries(screens)) {
    await nav(name);
    check(
      (await page.locator("#main h1").count()) === 1,
      `${name} has a single primary heading`,
    );
    for (const tab of tabs) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      check(
        (await page.locator("#main").innerText()).length > 120,
        `${name} / ${tab} renders`,
      );
    }
  }
  await nav("AI gateway", "Providers & models");
  await click("Add provider");
  await form({ Name: "Browser provider", "Native connector": "AWS Bedrock" });
  await click("Save");
  await click("Validate connection");
  await click("Discover models");
  await click("Approve model");
  await click("Publish catalog");
  check(
    (await state()).data.providers.at(-1).status === "Healthy",
    "WF-01 provider completes discovery and publication through the UI",
  );
  await close();
  await nav("AI gateway", "Applications & keys");
  await click("Add application");
  await form({ Name: "Browser assistant" });
  await click("Save");
  await click("Issue key");
  check(
    (await page.getByText("Copy this demo key now").count()) === 1,
    "WF-02 virtual credential is shown at issuance",
  );
  await click("Test application");
  await click("Run request");
  check(
    (await state()).data.traces[0].executed,
    "Application test records an executed request",
  );
  await click("Sensitive data");
  await click("Run request");
  check(
    (await state()).data.traces[0].decision === "REDACT",
    "Sensitive prompt is redacted from the UI flow",
  );
  await click("Prompt injection");
  await click("Run request");
  check(
    (await state()).data.traces[0].decision === "DENY",
    "Injection example stops before execution",
  );
  await role("Security admin");
  await nav("Guardrails", "Policy builder");
  await open("Enterprise baseline");
  await click("Edit draft");
  await form({ "Sensitive input action": "block" });
  await click("Save draft");
  await click("Simulate draft");
  await click("Request review");
  await close();
  await nav("Governance", "Approvals");
  let approval = (await state()).data.approvals.find(
    (a) => a.kind === "config",
  );
  await open(approval.name);
  await form({ "Review reason": "Reviewed independently in the browser" });
  await click("Record decision");
  check(
    (await page.getByRole("dialog").innerText()).includes("different person"),
    "WF-03 requester cannot approve their own policy",
  );
  await close();
  await page.getByLabel("Profile and workspace", { exact: true }).click();
  await form({ "Demo identity": "Arjun Rao" });
  await click("Switch context");
  await open(approval.name);
  await form({ "Review reason": "Independent reviewer approves the scope" });
  await click("Record decision");
  await nav("Guardrails", "Policy builder");
  await open("Enterprise baseline");
  await click("Publish 10% canary");
  await click("Promote canary");
  check(
    (await state()).data.policies[0].pii === "block",
    "Reviewed policy is promoted through the UI",
  );
  await click("Roll back");
  await form({ Reason: "Return to the baseline for regression checks" });
  await click("Roll back");
  await close();
  await role("Platform admin");
  await nav("Agents & MCP", "Agents");
  await click("Add agent");
  await form({
    Name: "Browser agent",
    Purpose: "Read approved claim documents",
  });
  await page
    .getByRole("dialog")
    .getByLabel("claims.read · READ", { exact: true })
    .check();
  await click("Save");
  await click("Test agent");
  await click("Run tool");
  check(
    (await state()).data.traces[0].executed,
    "WF-04 registered agent can execute a scoped read",
  );
  await page.getByLabel("Agent", { exact: true }).selectOption("finance-agent");
  await page
    .getByLabel("Tool", { exact: true })
    .selectOption("vendor.updateBankAccount");
  await click("Run tool");
  check(
    (await state()).data.traces[0].decision === "REQUIRE_APPROVAL",
    "WF-05 financial tool creates a pending request",
  );
  await role("Security admin");
  await nav("Governance", "Approvals");
  approval = (await state()).data.approvals.find(
    (a) => a.kind === "tool" && a.status === "Pending",
  );
  await open(approval.name);
  await form({ "Review reason": "Reviewed vendor and account reference" });
  await click("Record decision");
  await role("Platform admin");
  await nav("Agents & MCP", "Tool playground");
  await page.getByLabel("Agent", { exact: true }).selectOption("finance-agent");
  await page
    .getByLabel("Tool", { exact: true })
    .selectOption("vendor.updateBankAccount");
  await click("Run tool");
  check(
    (await state()).data.traces[0].executed,
    "Approved exact tool request executes after an explicit rerun",
  );
  await click("Run tool");
  check(
    !(await state()).data.traces[0].executed,
    "Single-use approval cannot execute twice",
  );
  await role("FinOps owner");
  await nav("FinOps", "Budget hierarchy");
  await page
    .getByRole("button", { name: "Add budget", exact: true })
    .first()
    .click();
  await form({
    Name: "Browser budget",
    "Spend limit (INR)": 35,
    "Parent budget": "org",
  });
  await click("Save draft");
  check(
    (await state()).data.budgets.at(-1).parent === "org",
    "WF-06 budget editor preserves the parent and draft lifecycle",
  );
  await close();
  await role("SOC analyst");
  await nav("Incidents");
  await open("Destructive tool call blocked");
  await click("Assign / add note");
  await form({
    "Assigned owner": "Neha Singh",
    "Investigation note": "Browser review confirms the unauthorized action",
  });
  await click("Save review");
  await click("Contain agent");
  await form({ Reason: "Contain this repeated destructive request" });
  await click("Contain agent");
  check(
    (await state()).data.agents.find((a) => a.id === "claims-agent").status ===
      "Suspended",
    "WF-07 incident containment updates the agent",
  );
  await click("Resolve");
  await form({ Reason: "Containment has been verified" });
  await click("Resolve incident");
  check(
    (await state()).data.incidents.find((i) => i.id === "INC-1042").status ===
      "Resolved",
    "Incident resolution records the review",
  );
  const exported = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export evidence", exact: true })
    .last()
    .click();
  const file = await exported;
  check(
    file.suggestedFilename() === "incident-evidence.json",
    "Incident evidence exports from the investigation",
  );
  await close();
  await role("Security admin");
  await nav("Workforce AI", "Activity");
  await click("Simulate activity");
  await click("Simulate event");
  check(
    (await state()).data.workforce.at(-1).action === "Block",
    "WF-08 simulated activity applies the published account policy",
  );
  await nav("Assurance", "Red team");
  await click("Add campaign");
  await form({ Name: "Browser release gate" });
  await click("Save");
  await click("Run campaign");
  await page.waitForTimeout(1400);
  check(
    (await state()).data.campaigns.at(-1).status === "Failed",
    "WF-09 campaign completes and blocks the release",
  );
  await click("Link remediation");
  await form({ Reason: "PR-42 binds the request guardrail" });
  await click("Link remediation");
  await close();
  await open("Browser release gate");
  await click("Retest");
  await page.waitForTimeout(1400);
  await click("Release gate");
  check(
    (await state()).data.campaigns.at(-1).gate === "Released",
    "Remediation and retest enable release",
  );
  await close();
  await nav("AI inventory", "Inventory");
  await page
    .getByLabel("Search AI inventory", { exact: true })
    .fill("no-such-record");
  check(
    (await page.getByText("No matching results", { exact: true }).count()) ===
      1,
    "Search has a usable empty state",
  );
  await page.getByLabel("Search AI inventory", { exact: true }).fill("Claims");
  await click("Save view");
  await form({ "View name": "Claims review" });
  await click("Save");
  check(
    (await state()).data.savedViews.some((v) => v.name === "Claims review"),
    "Table filters can be saved",
  );
  await page.keyboard.press("Control+k");
  await page
    .getByLabel("Global search", { exact: true })
    .fill("Browser assistant");
  await page
    .getByRole("button", { name: /Browser assistant projects/ })
    .click();
  check(
    (await page.getByRole("dialog").innerText()).includes("Browser assistant"),
    "Command palette opens a related object",
  );
  await page.keyboard.press("Escape");
  await role("Security admin");
  await nav("Guardrails", "Simulator");
  await page.getByLabel("Load a file sample", { exact: false }).setInputFiles({
    name: "sample-document.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 demo fixture"),
  });
  await click("Run simulation");
  check(
    (await page.locator("#main").innerText()).includes(
      "Simulated OCR extraction",
    ),
    "File upload exposes a labeled OCR simulation and a policy result",
  );
  await role("Auditor");
  await nav("AI gateway", "Playground");
  check(
    await page
      .getByRole("button", { name: "Run request", exact: true })
      .isDisabled(),
    "Auditor cannot execute runtime requests",
  );
  await role("Platform admin");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, tabs] of Object.entries(screens)) {
      await nav(name);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${name} overflows at ${width}`,
      );
      for (const tab of tabs) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${name}/${tab} overflows at ${width}`,
        );
      }
    }
    checks.push(`All navigation views fit ${width}px`);
    if (width === 390) {
      await nav("AI gateway", "Applications & keys");
      await page
        .getByLabel("Sort Applications & virtual keys", { exact: true })
        .selectOption("name");
      await click("Add application");
      await form({ Name: "Mobile assistant" });
      await click("Save");
      check(
        (await state()).data.projects.some(
          (p) => p.name === "Mobile assistant",
        ),
        "Mobile application creation persists through the same BFF",
      );
      check(
        await page
          .getByRole("dialog")
          .evaluate((e) => e.getBoundingClientRect().width <= 390),
        "Mobile detail dialog fits the viewport",
      );
      await close();
      await nav("Command center");
      await page.screenshot({
        path: path.join(results, "mobile-command-center.png"),
        fullPage: true,
      });
      await nav("Agents & MCP", "Tool playground");
      await page.screenshot({
        path: path.join(results, "mobile-tool-playground.png"),
        fullPage: true,
      });
    }
    if (width === 1440) {
      await nav("Command center");
      await page.screenshot({
        path: path.join(results, "command-center.png"),
        fullPage: true,
      });
      await nav("AI gateway", "Playground");
      await page.screenshot({
        path: path.join(results, "model-playground.png"),
        fullPage: true,
      });
    }
  }
  await page.reload();
  await ready();
  check(
    (await state()).data.projects.some((p) => p.name === "Browser assistant"),
    "Created application survives reload",
  );
  check(errors.length === 0, `No browser errors (${errors.join("; ")})`);
  fs.writeFileSync(
    path.join(results, "browser-results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(`${checks.length} browser checks passed`);
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
