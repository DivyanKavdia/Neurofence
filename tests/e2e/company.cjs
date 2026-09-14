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
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.setDefaultTimeout(12000);
    const ready = () => page.locator('#main[aria-busy="false"]').waitFor();
    const button = (name) => page.getByRole("button", { name, exact: true });
    const click = async (name) => {
      await button(name).click();
      await ready();
    };
    const tab = async (name) => {
      await page.getByRole("tab", { name, exact: true }).click();
      await ready();
    };
    const role = async (name) => {
      await page
        .getByRole("combobox", { name: "Role preview" })
        .selectOption(name);
      await ready();
    };
    const submit = async (name = "Save") => {
      await page
        .getByRole("dialog")
        .getByRole("button", { name, exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await ready();
    };
    const company = () =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("neurofence.companies.v1"),
        ).companies.find((c) => c.id === "browser-corp"),
      );
    const publish = async () => {
      await click("Validate draft");
      await click("Request review");
      await role("Security admin");
      await click("Approve draft");
      await page
        .getByLabel("Reason")
        .fill("Independent browser review of company settings");
      await submit("Approve configuration");
      await role("Company admin");
      await click("Publish configuration");
    };
    await page.goto(
      pathToFileURL(path.resolve(__dirname, "../../index.html")).href,
    );
    await ready();
    await role("Neurofence operator");
    await click("Onboard company");
    await page.getByLabel("Company name").fill("Browser Company");
    await page.getByLabel("Company identifier").fill("browser-corp");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await page.getByLabel("First administrator name").fill("Alice Example");
    await page
      .getByLabel("First administrator email")
      .fill("alice@browser.test");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await submit("Create company");
    assert.equal((await company()).status, "Onboarding");
    assert.equal(
      await page.getByRole("combobox", { name: "Role preview" }).inputValue(),
      "Company admin",
    );
    await tab("People & teams");
    await click("Invite member");
    await page.getByLabel("Member name").fill("Reviewer One");
    await page.getByLabel("Member email").fill("reviewer@browser.test");
    const assigned = page.getByRole("group", {
      name: "Assigned roles",
      exact: true,
    });
    await assigned.getByLabel("Developer").uncheck();
    await assigned.getByLabel("Security admin").check();
    await submit("Create invitation");
    assert.equal(
      (await company()).members.find((m) => m.name === "Reviewer One").status,
      "Invited",
    );
    await page
      .getByRole("row")
      .filter({ hasText: "Reviewer One" })
      .getByRole("button", { name: "Manage", exact: true })
      .click();
    await page.getByLabel("Membership status").selectOption("Active");
    await page
      .getByLabel("Membership change reason")
      .fill("Activate independent demo reviewer");
    await submit("Save membership");
    await click("Create team");
    await page.getByLabel("Team name").fill("Claims team");
    await page.getByLabel("Department").fill("Operations");
    await page.getByLabel("Cost center").fill("OPS-001");
    await submit();
    await tab("Overview");
    await click("Complete company onboarding");
    assert.equal((await company()).status, "Active");
    await click("Create demo application");
    await page
      .getByLabel("Reason")
      .fill("Initialize governed demo applications");
    await submit("Create starter resources");
    await tab("Configuration");
    await click("Edit runtime & budgets");
    await page.getByLabel("Maximum output tokens").fill("128");
    await page
      .getByLabel("Change reason")
      .fill("Company output ceiling for the pilot");
    await submit("Save draft");
    assert.equal((await company()).config.values.maxTokens, 4000);
    await click("Edit company profile");
    await page.getByLabel("Company name").fill("Browser Company Pilot");
    await page.getByLabel("Brand color").fill("#334477");
    await page
      .getByLabel("Change reason")
      .fill("Apply company branding and runtime defaults");
    await submit("Save draft");
    await publish();
    assert.equal((await company()).config.values.maxTokens, 128);
    assert.equal(
      await page.locator(".workspace-chip strong").textContent(),
      "Browser Company Pilot",
    );
    assert.equal(
      await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--company-brand"),
      ),
      "#334477",
    );
    await click("Add scoped override");
    await page
      .getByRole("combobox", { name: "Override scope", exact: true })
      .selectOption("project");
    await page.getByLabel("Override target").selectOption("claims");
    await page
      .getByRole("combobox", { name: "Override setting", exact: true })
      .selectOption("maxTokens");
    await page.getByLabel("Maximum output tokens").fill("64");
    await page
      .getByLabel("Change reason")
      .fill("Smaller claims application ceiling");
    await submit("Save override draft");
    await publish();
    await page
      .getByRole("combobox", { name: "Effective configuration application" })
      .selectOption("claims");
    await page
      .getByRole("cell", { name: "Project: claims", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("row")
        .filter({ hasText: "Maximum output tokens" })
        .last()
        .getByRole("cell")
        .nth(1)
        .textContent(),
      "64",
    );
    const results = path.resolve(__dirname, "../../test-results");
    fs.mkdirSync(results, { recursive: true });
    await page.screenshot({
      path: path.join(results, "company-configuration.png"),
      fullPage: true,
    });
    await tab("Provisioning");
    await click("New provisioning request");
    await page.getByLabel("Request type").selectOption("Identity connection");
    await page
      .getByLabel("Request details")
      .fill("Connect corporate identity provider during production rollout");
    await submit();
    assert.equal((await company()).provisioning[0].status, "Requested");
    await tab("History & audit");
    await button("Restore version").first().click();
    await page.getByLabel("Reason").fill("Review an earlier company version");
    await submit("Create rollback draft");
    assert.equal((await company()).draft.status, "Draft");
    await click("Discard draft");
    await page.getByLabel("Reason").fill("Keep the current published version");
    await submit("Discard draft");
    await tab("Overview");
    await click("Staging");
    assert.equal(
      await page.locator(".workspace-chip strong").textContent(),
      "Browser Company Pilot",
    );
    await page.reload();
    await ready();
    assert.match(
      await page.locator(".workspace-chip small").textContent(),
      /Staging/,
    );
    await click("Development");
    await page.screenshot({
      path: path.join(results, "company-overview.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(results, "company-mobile.png"),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Company page must fit a mobile viewport",
    );
    await tab("People & teams");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Company tables must scroll within the mobile viewport",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Company browser workflows passed: onboarding, membership, teams, publication, inheritance, branding, provisioning, rollback, persistence and mobile layout.",
    );
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
