const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
test("HTTP adapter serves the console and persists isolated, versioned BFF mutations", async () => {
  const data = mkdtempSync(join(tmpdir(), "neuralfence-http-"));
  const child = spawn(process.execPath, [".runtime/mock-server.cjs"], {
    env: { ...process.env, PORT: "18080", NF_MOCK_DATA: data },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        reject(new Error(`Mock server exited ${code}`)),
      );
      child.stdout.once("data", resolve);
    });
    const base = "http://127.0.0.1:18080";
    assert.match(await (await fetch(base + "/")).text(), /AI trust workspace/);
    assert.match(
      await (await fetch(base + "/config.js")).text(),
      /mode:'http'/,
    );
    const get = async (path, headers = {}) =>
      await (await fetch(base + path, { headers })).json();
    let state = (await get("/api/v1/workspace")).data;
    const row = state.data.projects.find((p) => p.id === "claims");
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": "http-update",
      "If-Match": String(row.version),
    };
    const options = {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "HTTP claims" }),
    };
    const saved = await (
      await fetch(base + "/api/v1/projects/claims", options)
    ).json();
    assert.equal(saved.data.name, "HTTP claims");
    assert.deepEqual(
      await (await fetch(base + "/api/v1/projects/claims", options)).json(),
      saved,
    );
    assert.equal(
      (await get("/api/v1/projects/claims")).data.name,
      "HTTP claims",
    );
    assert.equal(
      (await get("/api/v1/projects", { "X-Demo-Tenant": "northstar" })).data
        .length,
      0,
    );
    const unauthorized = await fetch(base + "/api/v1/projects/claims", {
      ...options,
      headers: {
        ...headers,
        "X-Demo-Role": "Auditor",
        "Idempotency-Key": "other",
      },
    });
    assert.equal(unauthorized.status, 403);
    assert.equal((await unauthorized.json()).error.code, "FORBIDDEN");
    assert.equal((await fetch(base + "/apps/api/src/server.ts")).status, 404);
    const firstScope = {
      "X-Demo-Tenant": "north-west",
      "X-Demo-Environment": "Development",
    };
    const secondScope = {
      "X-Demo-Tenant": "north",
      "X-Demo-Environment": "west-Development",
    };
    for (const [slug, environments] of [
      ["north-west", ["Development"]],
      ["north", ["west-Development"]],
    ]) {
      const response = await fetch(base + "/api/v1/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Demo-Role": "Neurofence operator",
          "X-Demo-User": "Neurofence operator",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          slug,
          name: slug,
          ownerName: "Divyan Kavdia",
          ownerEmail: "owner@example.test",
          environments,
        }),
      });
      assert.equal(response.status, 200);
    }
    const firstState = (await get("/api/v1/workspace", firstScope)).data;
    const rename = await fetch(base + "/api/v1/settings", {
      method: "PATCH",
      headers: {
        ...firstScope,
        "Content-Type": "application/json",
        "If-Match": String(firstState.settings.version),
        "Idempotency-Key": "isolated-setting",
      },
      body: JSON.stringify({ deployment: "Private cloud" }),
    });
    assert.equal(rename.status, 200);
    assert.equal(
      (await get("/api/v1/workspace", firstScope)).data.settings.deployment,
      "Private cloud",
    );
    assert.notEqual(
      (await get("/api/v1/workspace", secondScope)).data.settings.deployment,
      "Private cloud",
    );
    assert.equal(
      (
        await fetch(base + "/api/v1/workspace", {
          headers: { Origin: "https://unrelated.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/v1/runtime/model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid-json",
        })
      ).status,
      400,
    );
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) =>
      child.exitCode !== null ? resolve() : child.once("exit", resolve),
    );
    rmSync(data, { recursive: true, force: true });
  }
});
