const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
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
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(12000);
    const ready = () => page.locator('#main[aria-busy="false"]').waitFor();
    const state = () =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("neuralfence.console.v2.acme:Development"),
        ),
      );
    const button = (name) => page.getByRole("button", { name, exact: true });
    const click = async (name) => {
      await button(name).click();
      await ready();
    };
    const role = async (name) => {
      await page
        .getByRole("combobox", { name: "Role preview" })
        .selectOption(name);
      await ready();
    };
    const nav = async (name, tab) => {
      await page
        .locator("#sidebar")
        .getByRole("button", { name: new RegExp("^" + name) })
        .click();
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await ready();
    };
    const save = async () => {
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await ready();
    };
    await page.goto(
      pathToFileURL(path.resolve(__dirname, "../../index.html")).href,
    );
    await ready();
    await role("Security admin");
    await nav("AI inventory", "Discovery & risk");
    const before = (await state()).data.assets.length;
    await click("Import discovered assets");
    await click("Preview import");
    assert.equal(await button("Apply import").isEnabled(), true);
    await click("Apply import");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await state()).data.assets.length, before + 1);
    await click("Configure risk weights");
    await page.getByLabel("Protection weight").fill("40");
    await page.getByLabel("Approval weight").fill("15");
    await save();
    assert.equal((await state()).settings.riskWeights.protection, 40);
    fs.mkdirSync(path.resolve(__dirname, "../../test-results"), {
      recursive: true,
    });
    await page.screenshot({
      path: path.resolve(__dirname, "../../test-results/discovery-risk.png"),
      fullPage: true,
    });
    await nav("Guardrails", "Detectors");
    await click("Create dictionary detector");
    await page.getByLabel("Detector name").fill("Confidential roadmap");
    await page
      .getByLabel("Literal terms (one per line)")
      .fill("private roadmap\nA+B");
    await save();
    assert.ok(
      (await state()).data.detectors.some(
        (d) => d.name === "Confidential roadmap",
      ),
    );
    await role("FinOps owner");
    await nav("FinOps", "Prices & reconciliation");
    await click("Publish price version");
    await page
      .getByRole("dialog")
      .getByLabel(/^Model/)
      .selectOption({ index: 1 });
    await save();
    await click("Import external usage");
    await click("Preview import");
    await click("Apply import");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.ok(
      (await state()).data.traces.some(
        (t) => t.kind === "external" && t.cost > 0,
      ),
    );
    await button("Reconcile").first().click();
    await page.getByLabel("Invoice reference").fill("INV-BROWSER-001");
    await page
      .getByLabel("Reconciliation reason")
      .fill("Matched against the invoice line");
    await save();
    assert.ok(
      (await state()).data.traces.some((t) => t.invoice === "INV-BROWSER-001"),
    );
    await role("Security admin");
    await nav("Governance", "Evidence lifecycle");
    await button("Place hold").first().click();
    await page
      .getByLabel("Custody reason")
      .fill("Preserve evidence for incident review");
    await save();
    assert.ok((await state()).data.traces.some((t) => t.legalHold));
    await click("Map control evidence");
    await page.getByLabel("Control name").fill("Reviewed access");
    await page
      .getByLabel("Framework / internal standard")
      .fill("Internal standard");
    await page.getByLabel("Requirement or control ID").fill("AC-01");
    await page
      .getByRole("group", { name: "Evidence records", exact: true })
      .getByRole("checkbox")
      .first()
      .check();
    await save();
    const downloaded = page.waitForEvent("download");
    await click("Export evidence");
    assert.ok((await downloaded).suggestedFilename().startsWith("evidence-"));
    await role("Platform admin");
    await nav("Governance", "Policy distribution");
    await click("Build policy bundle");
    await save();
    await click("Acknowledge bundle");
    await save();
    assert.equal((await state()).data.distributions[0].status, "Acknowledged");
    await nav("Agents & MCP", "Workflows & delegation");
    await click("Run delegated tool call");
    const current = await state(),
      agent = current.data.agents.find((a) =>
        a.allowedTools.includes("claims.read"),
      );
    await page.getByLabel(/^Root agent/).selectOption(agent.id);
    await page.getByLabel(/^Tool \*/).selectOption("claims.read");
    await page.getByLabel("Sample tool result").selectOption("pii");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await page.getByRole("heading", { name: "Workflow decision" }).waitFor();
    assert.equal((await state()).data.traces[0].decision, "REDACT");
    await click("Close dialog");
    await role("Security admin");
    await nav("Assurance", "Red team");
    await page.getByRole("button", { name: /^Add / }).click();
    await page.getByLabel(/^Name \*/).fill("Scheduled browser regression");
    const submit = page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true });
    await submit.click();
    await page
      .getByRole("heading", {
        name: "Scheduled browser regression",
        exact: true,
      })
      .waitFor();
    await click("Close dialog");
    await nav("Assurance", "Schedules & provenance");
    await button("Edit schedule").first().click();
    await save();
    assert.ok((await state()).data.campaigns.some((c) => c.scheduleEnabled));
    await nav("Assurance", "Supply chain");
    await page.getByRole("button", { name: /^Add / }).click();
    await page.getByLabel(/^Name \*/).fill("Browser artifact package");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Browser artifact package", exact: true })
      .waitFor();
    await click("Close dialog");
    await nav("Assurance", "Schedules & provenance");
    await button("Record provenance").first().click();
    await page.getByLabel("SHA-256 digest").fill("a".repeat(64));
    await page.getByLabel(/^Publisher/).fill("Demo publisher");
    await page.getByLabel("License identifier").fill("MIT");
    await save();
    assert.ok(
      (await state()).data.scans.some(
        (s) => s.digest === "a".repeat(64) && s.gate === "Blocked",
      ),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await click("Profile and workspace");
    await click("Workspace action queue");
    await page
      .getByRole("heading", { name: "Workspace action queue" })
      .waitFor();
    await click("Close dialog");
    await click("Profile and workspace");
    await click("Contextual help");
    await page.getByRole("heading", { name: "Assurance help" }).waitFor();
    await page.screenshot({
      path: path.resolve(
        __dirname,
        "../../test-results/workflow-help-mobile.png",
      ),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "New workflows passed: imports, risk weights, dictionaries, prices, reconciliation, custody, mappings, distribution, delegation, schedules, provenance and mobile help.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
