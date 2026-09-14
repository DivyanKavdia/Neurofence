const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../..");
const results = path.join(root, "test-results");
fs.mkdirSync(results, { recursive: true });
(async () => {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".html")
            ? "text/html"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "application/octet-stream",
    );
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
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
      acceptDownloads: true,
    });
    const page = await context.newPage(),
      errors = [];
    context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(15000);
    const ready = (p = page) => p.locator('#main[aria-busy="false"]').waitFor();
    const button = (name, p = page) =>
      p.getByRole("button", { name, exact: true });
    const click = async (name, p = page) => {
      await button(name, p).click();
      await ready(p);
    };
    const tab = async (name, p = page) => {
      await p.getByRole("tab", { name, exact: true }).click();
      await ready(p);
    };
    const env = () =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("neurofence.demo.session"))
            .environment,
      );
    const state = () =>
      page.evaluate(() => {
        const session = JSON.parse(
          sessionStorage.getItem("neurofence.demo.session"),
        );
        return JSON.parse(
          localStorage.getItem(
            `neuralfence.console.v2.${session.tenant}:${session.environment}`,
          ),
        );
      });
    const modalSave = async (name, p = page) => {
      await p
        .getByRole("dialog")
        .getByRole("button", { name, exact: true })
        .click();
      await p.getByRole("dialog").waitFor({ state: "hidden" });
      await ready(p);
    };
    await page.goto(`${base}/#demo/scenarios`);
    await ready();
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    );
    assert.equal(
      await page.getByRole("combobox", { name: "Time range" }).count(),
      0,
    );
    await page.getByLabel("Company dataset").selectOption("Software company");
    await page.getByLabel("Dataset seed").fill("123");
    await page.getByLabel("Sample requests").selectOption("0");
    await page.getByRole("radio", { name: /Provider outage/ }).check();
    await page.getByLabel("Use synthetic demo data only.").check();
    await page.screenshot({
      path: path.join(results, "demo-studio-desktop.png"),
      fullPage: true,
    });
    await click("Create demo environment");
    await page.locator(".demo-current").waitFor();
    const original = await env();
    assert.match(original, /^Demo-/);
    await click("Run scenario request");
    await page
      .getByRole("heading", { name: "Scenario result", exact: true })
      .waitFor();
    assert.equal((await state()).data.traces[0].provider, "vertex");
    await click("Open policy tests");
    await button("Compare active and draft").waitFor();
    await click("Compare active and draft");
    await page.locator(".lab-results").waitFor();
    assert.equal(await page.locator(".lab-results tbody tr").count(), 4);
    assert.match(await page.locator(".lab-metrics").innerText(), /4\/4/);
    await click("Edit inputs");
    assert.equal(
      await page.locator(".app-shell").evaluate((n) => n.inert),
      true,
    );
    await page
      .getByLabel("Suite name", { exact: true })
      .fill("Gateway release checks");
    await page.getByLabel("Case 1 expected decision").selectOption("MONITOR");
    await page
      .getByLabel("These inputs contain synthetic demo data only.")
      .check();
    await modalSave("Save test suite");
    assert.equal(
      await button("Edit inputs").evaluate((n) => n === document.activeElement),
      true,
    );
    await click("Compare active and draft");
    await page.waitForFunction(() =>
      document.querySelector(".lab-metrics")?.textContent.includes("3/4"),
    );
    await page.getByLabel("Show cases").selectOption("Failed expectations");
    assert.equal(await page.locator(".lab-results tbody tr").count(), 1);
    const comparisonDownload = page.waitForEvent("download");
    await click("Export comparison");
    const comparison = JSON.parse(
      fs.readFileSync(await (await comparisonDownload).path(), "utf8"),
    );
    assert.equal(comparison.failures, 1);
    assert.equal(comparison.regressions, 0);
    await page.getByLabel("Show cases").selectOption("All cases");
    await page.screenshot({
      path: path.join(results, "policy-lab-desktop.png"),
      fullPage: true,
    });
    await click("Demo studio");
    await tab("Backup & restore");
    const snapshotDownload = page.waitForEvent("download");
    await click("Download demo snapshot");
    const snapshotPath = await (await snapshotDownload).path();
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    assert.equal(snapshot.payload.environment, original);
    const tampered = structuredClone(snapshot);
    tampered.payload.data.projects[0].name = "Modified";
    await page
      .getByLabel("Demo snapshot file")
      .setInputFiles({
        name: "modified.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(tampered)),
      });
    await page
      .getByText(
        "The snapshot checksum does not match. Re-export the original file.",
        { exact: true },
      )
      .first()
      .waitFor();
    assert.equal(await button("Restore into new demo").count(), 0);
    await page
      .getByLabel("Demo snapshot file")
      .setInputFiles({
        name: "saved-demo.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(snapshot)),
      });
    await page.locator(".restore-preview").waitFor();
    await page
      .getByLabel("This file contains synthetic demo data only.")
      .check();
    await click("Restore into new demo");
    await page.locator(".demo-current").waitFor();
    const restored = await env();
    assert.notEqual(restored, original);
    await click("Open policy tests");
    await button("Edit inputs").waitFor();
    assert.equal(
      await page.locator(".lab-content h3").first().innerText(),
      "Gateway release checks",
    );
    // Two independent transports read the same suite. A stale editor must not overwrite the saved update.
    const second = await context.newPage();
    second.setDefaultTimeout(15000);
    await second.goto(`${base}/#company/overview`);
    await ready(second);
    await click("Switch workspace", second);
    await second
      .getByLabel("Environment", { exact: true })
      .selectOption(restored);
    await modalSave("Switch context", second);
    await click("Guardrails", second);
    await tab("Test lab", second);
    await button("Edit inputs", second).waitFor();
    await click("Edit inputs");
    await page
      .getByLabel("Suite name", { exact: true })
      .fill("Unsaved local name");
    await page
      .getByLabel("These inputs contain synthetic demo data only.")
      .check();
    await click("Edit inputs", second);
    await second
      .getByLabel("Suite name", { exact: true })
      .fill("Edited elsewhere");
    await second
      .getByLabel("These inputs contain synthetic demo data only.")
      .check();
    await modalSave("Save test suite", second);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save test suite", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByText(/This record changed/)
      .waitFor();
    assert.equal(
      await page.getByLabel("Suite name", { exact: true }).inputValue(),
      "Unsaved local name",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page
      .getByText("This workspace changed in another tab.", { exact: true })
      .waitFor();
    await click("Refresh workspace");
    await page
      .getByRole("heading", { name: "Edited elsewhere", exact: true })
      .waitFor();
    await second.close();
    await click("Demo studio");
    await click("Reset this demo");
    await page.getByLabel("Confirm environment name").fill(restored);
    await page.getByLabel("Reason").fill("Recreate the original demo scenario");
    await modalSave("Reset demo environment");
    assert.equal((await state()).data.traces.length, 0);
    await page.reload();
    await ready();
    assert.equal(await env(), restored);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(results, "demo-studio-mobile.png"),
      fullPage: true,
    });
    let size = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      size.scroll <= size.width + 1,
      `Demo studio mobile width ${size.scroll}`,
    );
    await click("Open policy tests");
    await button("Compare active and draft").waitFor();
    await click("Compare active and draft");
    await page.locator(".lab-results").waitFor();
    size = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      size.scroll <= size.width + 1,
      `Policy lab mobile width ${size.scroll}`,
    );
    assert.ok(
      (await button("Compare active and draft").boundingBox()).height >= 44,
    );
    await page.screenshot({
      path: path.join(results, "policy-lab-mobile.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "Policy and demo browser flows passed: scenarios, comparison, editing, exports, snapshot validation/restore, concurrent tabs, reset, persistence, focus and mobile layout.",
    );
  } catch (error) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) {
      await page.screenshot({
        path: path.join(results, "labs-failure.png"),
        fullPage: true,
      });
      console.error((await page.locator("body").innerText()).slice(-5000));
    }
    throw error;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
