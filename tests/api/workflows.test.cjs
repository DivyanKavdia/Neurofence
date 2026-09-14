const { names, publishCompany } = require("../helpers/company.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { MockBackend, MemoryStore } = require("../../.runtime/backend.cjs");
function fixture() {
  const store = new MemoryStore(),
    api = new MockBackend(store, 0);
  const role = (role, user = names[role]) =>
    api.setSession({ ...api.session, role, user });
  const read = async () =>
    (await api.request({ path: "/api/v1/workspace" })).data;
  const send = async (
    path,
    body = {},
    row,
    method = "POST",
    key = crypto.randomUUID(),
  ) =>
    (
      await api.request({
        path,
        body,
        method,
        version: row?.version,
        idempotencyKey: key,
      })
    ).data;
  const change = (fn) => {
    const state = store.read("acme:Development");
    fn(state);
    store.write("acme:Development", state);
  };
  return { store, api, role, read, send, change };
}

test("Discovery import is atomic, scoped, repeatable and preserves reviewed ownership", async () => {
  const f = fixture();
  await f.read();
  const entry = {
    externalId: "app-001",
    name: "Discovered assistant",
    type: "Application",
    classification: "Restricted",
    owner: "Unassigned",
    links: [],
  };
  await assert.rejects(
    f.send("/api/v1/operations/inventory/import", {
      source: "cmdb",
      entries: [entry],
    }),
    /cannot perform/,
  );
  f.role("Security admin");
  const before = (await f.read()).data.assets.length;
  const preview = await f.send("/api/v1/operations/inventory/preview", {
    source: "cmdb",
    entries: [entry],
  });
  assert.equal(preview[0].asset.riskScore, 100);
  const settings = (await f.read()).settings;
  await assert.rejects(
    f.send(
      "/api/v1/operations/inventory/weights",
      { protection: 100, ownership: 20, classification: 25, approval: 20 },
      settings,
    ),
    /adding up to 100/,
  );
  await f.send(
    "/api/v1/operations/inventory/weights",
    { protection: 40, ownership: 20, classification: 25, approval: 15 },
    settings,
  );
  assert.equal((await f.read()).data.assets.length, before);
  await assert.rejects(
    f.send("/api/v1/operations/inventory/import", {
      source: "cmdb",
      entries: [entry, { ...entry, externalId: "app-002", type: "Unknown" }],
    }),
    /supported asset/,
  );
  assert.equal((await f.read()).data.assets.length, before);
  const first = (
    await f.send("/api/v1/operations/inventory/import", {
      source: "cmdb",
      entries: [entry],
    })
  )[0].asset;
  const updated = await f.send(
    `/api/v1/assets/${first.id}`,
    { owner: "Security team" },
    first,
    "PATCH",
  );
  const repeat = await f.send("/api/v1/operations/inventory/import", {
    source: "cmdb",
    entries: [{ ...entry, name: "Changed discovered name" }],
  });
  assert.equal(repeat[0].asset.owner, updated.owner);
  assert.equal(repeat[0].asset.bomVersion, 2);
  assert.equal((await f.read()).data.assets.length, before + 1);
  assert.equal(
    (
      await f.send("/api/v1/operations/inventory/import", {
        source: "cmdb",
        entries: [{ ...entry, name: "Changed discovered name" }],
      })
    )[0].change,
    "Unchanged",
  );
  f.api.setSession({ ...f.api.session, tenant: "northstar" });
  assert.equal((await f.read()).data.assets.length, 0);
});

test("Effective prices, disjoint token categories and stable IDs prevent double billing", async () => {
  const f = fixture(),
    state = await f.read(),
    model = state.data.models[0],
    project = state.data.projects[0],
    ts = Date.now() - 60000;
  const price = await f.send("/api/v1/operations/finops/price", {
    model: model.id,
    effectiveAt: ts - 1000,
    currency: "INR",
    inputRate: 100,
    outputRate: 200,
    cacheRate: 50,
    reasoningRate: 400,
  });
  const entry = {
    externalId: "provider-line-1",
    project: project.id,
    model: model.id,
    ts,
    inputTokens: 1000,
    outputTokens: 1000,
    cacheTokens: 1000,
    reasoningTokens: 1000,
    costCenter: "Claims",
  };
  const before = (await f.read()).data.traces.length;
  await f.send("/api/v1/operations/finops/usage-preview", {
    source: "provider-invoice",
    entries: [entry],
  });
  assert.equal((await f.read()).data.traces.length, before);
  const trace = (
    await f.send("/api/v1/operations/finops/usage-import", {
      source: "provider-invoice",
      entries: [entry],
    })
  )[0].trace;
  assert.equal(trace.cost, 0.75);
  assert.equal(trace.tokens, 4000);
  assert.equal(trace.priceVersion, price.id);
  await f.send("/api/v1/operations/finops/usage-import", {
    source: "provider-invoice",
    entries: [entry],
  });
  assert.equal((await f.read()).data.traces.length, before + 1);
  await assert.rejects(
    f.send("/api/v1/operations/finops/usage-import", {
      source: "provider-invoice",
      entries: [{ ...entry, inputTokens: 2000 }],
    }),
    /different usage/,
  );
  const changed = await f.send(
    "/api/v1/operations/finops/reconcile",
    {
      trace: trace.id,
      cost: 0.8,
      invoice: "INV-2026-001",
      reason: "Verified invoice adjustment",
    },
    trace,
  );
  assert.equal(changed.cost, 0.8);
  assert.equal(changed.adjustments[0].before, 0.75);
  await assert.rejects(
    f.send(
      "/api/v1/operations/finops/reconcile",
      {
        trace: trace.id,
        cost: 1,
        invoice: "INV-2026-002",
        reason: "Stale invoice update",
      },
      trace,
    ),
    /changed/,
  );
  f.role("Developer");
  await assert.rejects(
    f.send("/api/v1/operations/finops/usage-import", {
      source: "provider-invoice",
      entries: [entry],
    }),
    /cannot perform/,
  );
});

test("Dictionary rules are literal, stage-aware, bounded and included in policy simulation", async () => {
  const f = fixture();
  await f.read();
  f.role("Security admin");
  const detector = await f.send("/api/v1/operations/detectors/save", {
    name: "Internal codenames",
    terms: ["A+B", "Private Roadmap", "Secret 123456789012"],
    stages: ["Tool result", "Response"],
  });
  f.change((s) => {
    s.data.policies
      .find((p) => p.id === "baseline")
      .detectors.push(detector.id);
  });
  const inspect = (text, stage) =>
    f.send("/api/v1/inspect", { policy: "baseline", text, stage });
  assert.equal((await inspect("A+B", "Request")).decision, "ALLOW");
  const result = await inspect("A+B and PRIVATE ROADMAP", "Tool result");
  assert.equal(result.decision, "REDACT");
  assert.equal(result.findings.length, 2);
  assert.deepEqual([result.findings[0].start, result.findings[0].end], [0, 3]);
  assert.ok(!result.text.includes("A+B"));
  assert.equal(
    (await inspect("Secret 123456789012", "Tool result")).text,
    "[REDACTED]",
  );
  assert.equal((await inspect("AAAB", "Tool result")).decision, "ALLOW");
  assert.equal(
    (await inspect("A+B ".repeat(1100), "Tool result")).decision,
    "DENY",
  );
  const match = (await f.read()).data.detectors.find(
    (d) => d.id === detector.id,
  );
  await f.send(
    `/api/v1/detectors/${detector.id}`,
    { status: "Disabled" },
    match,
    "PATCH",
  );
  assert.equal((await inspect("A+B", "Tool result")).decision, "ALLOW");
});

test("Tool-result inspection preserves charges while agent scope and delegation deny before execution", async () => {
  const f = fixture();
  const state = await f.read();
  const agent = state.data.agents.find((a) =>
    a.allowedTools.includes("claims.read"),
  );
  assert.ok(agent);
  const run = (extra = {}) =>
    f.send("/api/v1/runtime/tool", {
      agent: agent.id,
      tool: "claims.read",
      args: { claim_id: "CLAIM-1042" },
      ...extra,
    });
  let trace = await run({ responsePreset: "pii" });
  assert.equal(trace.executed, true);
  assert.equal(trace.decision, "REDACT");
  assert.equal(trace.cost, 0.08);
  assert.ok(!trace.output.includes("123456789012"));
  trace = await run({ responsePreset: "injection" });
  assert.equal(trace.executed, true);
  assert.equal(trace.decision, "DENY");
  assert.equal(trace.cost, 0.08);
  assert.equal(trace.output, "");
  f.change((s) => {
    s.data.agents.find((a) => a.id === agent.id).dataScope = "CLAIM-9999";
  });
  assert.equal((await run()).executed, false);
  f.change((s) => {
    const root = s.data.agents.find((a) => a.id === agent.id);
    root.dataScope = "CLAIM-*";
    const delegate = {
      ...root,
      id: "delegate-1",
      version: 1,
      name: "Claims delegate",
      allowedDelegates: [],
    };
    s.data.agents.push(delegate);
    root.allowedDelegates = [delegate.id];
  });
  assert.equal((await run({ delegates: ["delegate-1"] })).executed, true);
  assert.equal(
    (await run({ delegates: ["delegate-1", agent.id] })).executed,
    false,
  );
  f.change((s) => {
    s.data.agents.find((a) => a.id === "delegate-1").environment = "Production";
  });
  assert.equal((await run({ delegates: ["delegate-1"] })).executed, false);
  f.change((s) => {
    s.data.agents.find((a) => a.id === agent.id).maxCost = 0;
  });
  assert.equal((await run()).executed, false);
});

test("Agent model grants share workflow costs and enforce a model-call ceiling", async () => {
  const f = fixture(),
    state = await f.read(),
    agent = state.data.agents[0];
  const run = () =>
    f.send("/api/v1/runtime/model", {
      project: agent.project,
      agent: agent.id,
      prompt: "Summarise approved records",
      maxTokens: 100,
    });
  assert.equal((await run()).executed, false);
  f.change((s) => {
    const a = s.data.agents.find((r) => r.id === agent.id);
    a.allowedModels = s.data.models.map((m) => m.id);
    a.maxModelCalls = 1;
    a.maxCost = 10;
  });
  const trace = await run();
  assert.equal(trace.executed, true);
  assert.equal(trace.workflow, agent.workflow);
  assert.match((await run()).reason, /model-call limit/);
});

test("Distribution gates execution on acknowledgement, expiry and published configuration drift", async () => {
  const f = fixture();
  await f.read();
  let bundle = await f.send("/api/v1/operations/distribution/build", {
    ttl: 3600,
  });
  const run = () =>
    f.send("/api/v1/runtime/model", {
      project: "claims",
      prompt: "Approved summary",
      maxTokens: 100,
    });
  assert.equal((await run()).executed, false);
  bundle = await f.send(
    "/api/v1/operations/distribution/acknowledge",
    { bundle: bundle.id, outcome: "failure" },
    bundle,
  );
  assert.equal((await run()).executed, false);
  bundle = await f.send(
    "/api/v1/operations/distribution/acknowledge",
    { bundle: bundle.id, outcome: "success" },
    bundle,
  );
  assert.equal((await run()).executed, true);
  f.change((s) => {
    s.settings.controlPlane = "Unavailable";
  });
  assert.equal((await run()).executed, true);
  f.change((s) => {
    s.data.policies[0].pii = "block";
  });
  assert.match((await run()).reason, /configuration changed/);
  f.change((s) => {
    s.data.distributions[0].expiresAt = Date.now() - 1;
  });
  assert.match((await run()).reason, /expired/);
});

test("Evidence holds survive retention changes; reviewed purge preserves ledger and receipts", async () => {
  const f = fixture();
  await f.read();
  f.role("Security admin");
  await publishCompany(f.api, {
    rawContent: true,
    retention: "Full content",
    days: 1,
  });
  f.change((s) => {
    for (const t of s.data.traces.slice(0, 2)) {
      t.ts = Date.now() - 3 * 86400000;
      t.content = { prompt: "Retained sample" };
      t.modelRuntime = "litellm-fixture";
    }
  });
  let state = await f.read(),
    held = state.data.traces[0],
    other = state.data.traces[1];
  await f.send(
    "/api/v1/operations/evidence/hold",
    { trace: held.id, reason: "Investigation evidence preservation" },
    held,
  );
  const preview = await f.send("/api/v1/operations/evidence/retention-preview");
  assert.ok(preview.eligible.some((r) => r.id === other.id));
  assert.ok(!preview.eligible.some((r) => r.id === held.id));
  await f.send(
    "/api/v1/operations/evidence/hold",
    { trace: other.id, reason: "Additional investigation evidence" },
    other,
  );
  await assert.rejects(
    f.send("/api/v1/operations/evidence/purge", {
      token: preview.token,
      reason: "Purge expired content",
    }),
    /preview changed/,
  );
  f.role("Platform admin");
  state = await f.read();
  await publishCompany(f.api, { rawContent: false });
  await f.read();
  assert.ok(
    f.store.read("acme:Development").data.traces.find((t) => t.id === held.id)
      .content,
  );
  f.role("Security admin");
  state = await f.read();
  other = state.data.traces.find((t) => t.id === other.id);
  await f.send(
    "/api/v1/operations/evidence/release",
    { trace: other.id, reason: "Investigation scope narrowed" },
    other,
  );
  const next = await f.send("/api/v1/operations/evidence/retention-preview");
  const originalCost = other.cost;
  await f.send("/api/v1/operations/evidence/purge", {
    token: next.token,
    reason: "Apply reviewed content retention",
  });
  state = await f.read();
  other = state.data.traces.find((t) => t.id === other.id);
  assert.ok(other.contentPurgedAt);
  assert.equal(other.cost, originalCost);
  assert.equal(state.data.traces.find((t) => t.id === held.id).legalHold, true);
  assert.ok(
    state.data.audit.some((a) => a.event === "Purged expired trace content"),
  );
});

test("Control evidence exports omit raw content and approval payloads", async () => {
  const f = fixture(),
    state = await f.read();
  f.role("Security admin");
  const control = await f.send("/api/v1/operations/evidence/control", {
    name: "Internal access control",
    framework: "Customer policy",
    requirement: "AC-01",
    owner: "Mira Kapoor",
    references: [state.data.traces[0].id, state.data.policies[0].id],
  });
  const result = await f.send("/api/v1/operations/evidence/export", {
    control: control.id,
  });
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.evidence.length, 2);
  assert.ok(
    result.evidence.every(
      (r) => !r.content && !r.preview && !r.args && !r.fingerprint,
    ),
  );
  f.role("Developer");
  assert.equal((await f.read()).data.controls.length, 0);
});

test("Scheduled assurance runs coalesce missed intervals and provenance drift invalidates release", async () => {
  const f = fixture(),
    state = await f.read();
  f.role("Security admin");
  const campaign =
    state.data.campaigns[0] ||
    (await f.send("/api/v1/campaigns", {
      name: "Scheduled review",
      target: "claims",
      pack: "Baseline",
      schedule: "Manual",
      gate: "Blocked",
    }));
  const scan =
    state.data.scans[0] ||
    (await f.send("/api/v1/scans", {
      name: "Artifact review",
      target: "claims",
      artifact: "Model package",
      provenance: "Unverified",
      gate: "Blocked",
    }));
  await f.send(
    "/api/v1/operations/assurance/schedule",
    { id: campaign.id, schedule: "Daily", nextRunAt: Date.now() + 60000 },
    campaign,
  );
  f.change((s) => {
    s.data.campaigns.find((r) => r.id === campaign.id).nextRunAt =
      Date.now() - 3 * 86400000;
  });
  let after = await f.read();
  assert.equal(
    after.data.campaigns.find((r) => r.id === campaign.id).status,
    "Running",
  );
  await f.read();
  after = await f.read();
  assert.equal(
    after.data.jobs.filter(
      (j) => j.resource === campaign.id && j.status === "Running",
    ).length,
    1,
  );
  let artifact = await f.send(
    "/api/v1/operations/assurance/provenance",
    {
      id: scan.id,
      digest: "a".repeat(64),
      publisher: "Demo publisher",
      license: "MIT",
    },
    scan,
  );
  assert.equal(artifact.status, "Quarantined");
  assert.equal(artifact.gate, "Blocked");
  await assert.rejects(
    f.send(`/api/v1/scans/${scan.id}/gate`, {}, artifact),
    /passing retest/,
  );
  f.change((s) => {
    const a = s.data.scans.find((r) => r.id === scan.id);
    a.status = "Passed";
    a.approvedDigest = a.digest;
    a.remediation = "Reviewed artifact";
  });
  artifact = (await f.read()).data.scans.find((r) => r.id === scan.id);
  artifact = await f.send(`/api/v1/scans/${scan.id}/gate`, {}, artifact);
  assert.equal(artifact.gate, "Released");
  artifact = await f.send(
    "/api/v1/operations/assurance/provenance",
    {
      id: scan.id,
      digest: "b".repeat(64),
      publisher: "Demo publisher",
      license: "MIT",
    },
    artifact,
  );
  assert.equal(artifact.gate, "Blocked");
  assert.equal(artifact.remediation, undefined);
});

test("New collections migrate into a saved workspace without resetting prior decisions", async () => {
  const f = fixture();
  await f.read();
  f.change((s) => {
    delete s.data.prices;
    delete s.data.controls;
    delete s.data.distributions;
    s.data.tools[0].status = "Blocked";
  });
  const state = await f.read();
  assert.deepEqual(state.data.prices, []);
  assert.deepEqual(state.data.controls, []);
  assert.deepEqual(state.data.distributions, []);
  assert.equal(state.data.tools[0].status, "Blocked");
});

test("Archived MCP resources and unapproved model catalogs cannot execute", async () => {
  const f = fixture(),
    state = await f.read();
  const agent = state.data.agents.find((a) =>
    a.allowedTools.includes("claims.read"),
  );
  const tool = state.data.tools.find((t) => t.id === "claims.read");
  const server = state.data.servers.find((s) => s.id === tool.serverId);
  const run = () =>
    f.send("/api/v1/runtime/tool", {
      agent: agent.id,
      tool: tool.id,
      args: { claim_id: "CLAIM-1042" },
    });
  let changed = await f.send(
    `/api/v1/servers/${server.id}/status`,
    { status: "Archived" },
    server,
  );
  assert.equal((await run()).executed, false);
  await f.send(
    `/api/v1/servers/${server.id}/status`,
    { status: "Active" },
    changed,
  );
  f.role("Security admin");
  await f.send(`/api/v1/tools/${tool.id}/status`, { status: "Archived" }, tool);
  assert.equal((await run()).executed, false);
  f.role("Platform admin");
  for (const model of state.data.models)
    await f.send(
      `/api/v1/models/${model.id}/status`,
      { status: "Archived" },
      model,
    );
  const trace = await f.send("/api/v1/runtime/model", {
    project: "claims",
    prompt: "Approved summary",
    maxTokens: 100,
  });
  assert.equal(trace.executed, false);
  assert.equal(trace.cost, 0);
});
