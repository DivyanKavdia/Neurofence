import {
  demoScenarios,
  DemoTemplate,
  DemoWorkspace,
  demoRequest,
  ScenarioId,
} from "@neurofence/contracts/demo";
import {
  ApiError,
  arr,
  Collection,
  State,
  str,
  uid,
} from "@neurofence/contracts/types";
import { starterCases } from "@neurofence/contracts/policy-lab";
import { resolveCompanyConfig } from "@neurofence/contracts/company";
import { RequestContext } from "../context";
import { resolveMembership } from "../company/directory";
import { createState } from "../fixtures/seed";
import { runModel } from "../execution/model";
import { runTool } from "../execution/tool";
import { hash, requireValue } from "../shared/values";
import {
  createDemoBackup,
  restoreDemoData,
  validateDemoBackup,
} from "./demo-backup";

async function scenarioState(
  ctx: RequestContext,
  environment: string,
  demo: DemoWorkspace,
): Promise<State> {
  const state = createState(undefined, "acme"),
    session = { ...ctx.session, environment };
  Object.assign(
    state.settings,
    resolveCompanyConfig(ctx.company, environment).values,
    {
      companyStatus: ctx.company.status,
      companyConfigVersion: ctx.company.publishedVersion,
    },
  );
  state.demoWorkspace = demo;
  for (const c of [
    "traces",
    "approvals",
    "incidents",
    "audit",
    "workforce",
    "jobs",
    "distributions",
    "campaigns",
    "scans",
  ] as const)
    state.data[c] = [];
  for (const row of [
    ...state.data.projects,
    ...state.data.agents,
    ...state.data.assets,
  ])
    row.owner = session.user;
  for (const a of state.data.agents) {
    a.environment = environment;
    a.workflow = `demo-workflow-${demo.seed}-${a.id}`;
  }
  if (demo.template === "Software company") {
    state.data.projects[0].name = "Product assistant";
    state.data.projects[1].name = "Support assistant";
    state.data.projects[2].name = "Supplier operations";
    for (const asset of state.data.assets) {
      const project = state.data.projects.find((p) => p.id === asset.linked);
      if (project) asset.name = project.name;
    }
  }
  const find = (c: Collection, id: string) => {
    const row = state.data[c].find((r) => r.id === id);
    requireValue(row, "A scenario resource is missing.");
    return row!;
  };
  const audit = (event: string, detail: string, reference = "") =>
    state.data.audit.unshift({
      id: uid("event"),
      version: 1,
      ts: Date.now(),
      actor: session.user,
      event,
      detail,
      reference,
      tenant: session.tenant,
      environment,
    });
  // Reproducible input variation; the current company's controls remain authoritative.
  let random = demo.seed;
  for (let i = 0; i < demo.samples; i++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const project = state.data.projects[random % state.data.projects.length];
    const effective = {
      ...state,
      settings: {
        ...state.settings,
        ...resolveCompanyConfig(ctx.company, environment, project.id).values,
      },
    };
    const trace = await runModel(
      undefined,
      effective,
      session,
      {
        project: project.id,
        prompt: `Summarise public guide ${random % 1000}.`,
        maxTokens: 50 + (random % 100),
      },
      find,
      audit,
    );
    trace.companyConfigVersion = ctx.company.publishedVersion;
    trace.demoGenerated = true;
    state.data.traces.unshift(trace);
  }
  if (demo.scenario === "provider-outage")
    find("providers", "azure").status = "Unavailable";
  if (demo.scenario === "budget-exhausted") {
    const budget = find("budgets", "b-claims");
    budget.limit = 0;
    budget.hard = true;
    budget.action = "Block";
  }
  if (demo.scenario === "expired-approval") {
    const request = demoRequest(demo.scenario);
    const effective = {
      ...state,
      settings: {
        ...state.settings,
        ...resolveCompanyConfig(ctx.company, environment, "finance").values,
      },
    };
    const trace = runTool(effective, session, request.body, find, audit);
    for (const approval of state.data.approvals) {
      approval.expires = Date.now() - 60000;
      approval.status = "Expired";
    }
    trace.demoGenerated = true;
    state.data.traces.unshift(trace);
  }
  state.policyLab = {
    suites: [
      {
        id: `suite-demo-${demo.seed}`,
        version: 1,
        name: "Baseline safety checks",
        policy: "baseline",
        owner: resolveMembership(ctx.company, ctx.session).id,
        updatedAt: Date.now(),
        syntheticOnly: true,
        cases: structuredClone(starterCases),
      },
    ],
    runs: [],
  };
  audit(
    "Demo scenario created",
    `${demo.template}; ${demo.scenario}; seed ${demo.seed}`,
  );
  return state;
}

export async function handleDemo(ctx: RequestContext) {
  if (ctx.resource !== "demo") return;
  const { id, method, body, company, services, session } = ctx;
  ctx.permission("company");
  requireValue(
    !ctx.providerConnector,
    "Demo studio is available with the dummy backend. Select a separate mock workspace to use it.",
  );
  if (id === "scenarios" && method === "GET")
    return ctx.respond({
      scenarios: demoScenarios,
      current: ctx.state.demoWorkspace || null,
    });
  if (id === "reset" && method === "POST") {
    requireValue(
      ctx.state.demoWorkspace?.managed &&
        body.environment === session.environment,
      "Only the selected Demo studio environment can be reset. Confirm its exact name.",
    );
    requireValue(
      str(body.reason).trim().length >= 5,
      "Record a reason for resetting this demo.",
    );
    requireValue(
      !Object.keys(ctx.state.gatewayReceipts || {}).length,
      "Live execution receipts must be retained.",
    );
    ctx.checkVersion({ id: session.environment, version: ctx.state.revision });
    const next = await scenarioState(ctx, session.environment, {
      ...ctx.state.demoWorkspace!,
      createdAt: Date.now(),
    });
    next.revision = ctx.state.revision + 1;
    next.settings.version = ctx.state.settings.version + 1;
    for (const collection of Object.keys(next.data) as Collection[])
      for (const row of next.data[collection]) {
        const before = ctx.state.data[collection].find((r) => r.id === row.id);
        row.version = Math.max(row.version, before?.version || 0) + 1;
        if (row.publishedVersion) row.publishedVersion = row.version;
      }
    for (const suite of next.policyLab?.suites || [])
      suite.version =
        (ctx.state.policyLab?.suites.find((s) => s.id === suite.id)?.version ||
          0) + 1;
    next.data.audit.unshift({
      id: uid("event"),
      version: 1,
      ts: Date.now(),
      actor: session.user,
      event: "Demo environment reset",
      detail: str(body.reason).slice(0, 500),
      tenant: company.id,
      environment: session.environment,
    });
    services.store.write(ctx.key, next);
    for (const key of services.receipts.keys())
      if (key.startsWith(`${ctx.key}:`)) services.receipts.delete(key);
    return ctx.respond({ reset: true }, false);
  }
  if (id === "backup" && method === "POST") {
    const backup = await createDemoBackup(
      ctx.state,
      company.id,
      session.environment,
      company.publishedVersion,
    );
    ctx.audit(
      "Demo snapshot exported",
      `${session.environment}; ${backup.digest.slice(0, 12)}`,
    );
    return ctx.respond(backup);
  }
  if (id === "preview" && method === "POST") {
    const backup = await validateDemoBackup(body.backup, company.id);
    return ctx.respond(
      {
        digest: backup.digest,
        company: backup.payload.company,
        environment: backup.payload.environment,
        template: backup.payload.demo.template,
        scenario: backup.payload.demo.scenario,
        createdAt: backup.payload.createdAt,
        records: Object.values(backup.payload.data).reduce(
          (n, rows) => n + rows.length,
          0,
        ),
        suites: backup.payload.policyLab?.suites.length || 0,
        companyConfigChanged:
          company.publishedVersion !== backup.payload.companyConfigVersion,
      },
      false,
    );
  }
  if (!["create", "restore"].includes(id) || method !== "POST")
    throw new ApiError(404, "UNKNOWN_ACTION", "Unsupported demo action.");
  const receiptKey = `demo:${await hash(ctx.receiptKey)}`,
    payloadHash = await hash(ctx.payload);
  const receipt = ctx.directory.receipts[receiptKey];
  if (receipt) {
    requireValue(
      receipt.payload === payloadHash,
      "This demo request key was already used with different values.",
    );
    return ctx.respond(receipt.data, false);
  }
  ctx.checkVersion({ id: company.id, version: company.version });
  requireValue(
    body.syntheticOnly === true,
    "Confirm this workspace is for synthetic demo data.",
  );
  requireValue(
    company.environments.filter((e) => e.startsWith("Demo-")).length < 12,
    "This company already has 12 demo environments. Reuse one with Reset this demo.",
  );
  const environment = `Demo-${crypto.randomUUID().slice(0, 8)}`;
  const key = `${company.id}:${environment}`;
  requireValue(
    !services.store.read(key) && !company.environments.includes(environment),
    "Choose another demo environment.",
  );
  let state: State;
  if (id === "restore") {
    requireValue(
      Object.keys(body).every((k) =>
        ["backup", "digest", "syntheticOnly"].includes(k),
      ),
      "Unknown restore field.",
    );
    const backup = await validateDemoBackup(body.backup, company.id);
    requireValue(
      body.digest === backup.digest,
      "Preview this exact snapshot before restoring it.",
    );
    state = restoreDemoData(
      backup,
      createState(undefined, company.id),
      session.user,
      resolveMembership(company, session).id,
      environment,
    );
    state.data.audit.unshift({
      id: uid("event"),
      version: 1,
      ts: Date.now(),
      actor: session.user,
      event: "Demo snapshot restored",
      detail: `Source ${backup.payload.environment}; checksum ${backup.digest.slice(0, 12)}`,
      tenant: company.id,
      environment,
    });
  } else {
    requireValue(
      Object.keys(body).every((k) =>
        ["scenario", "template", "seed", "samples", "syntheticOnly"].includes(
          k,
        ),
      ),
      "Unknown demo scenario field.",
    );
    requireValue(
      demoScenarios.some((s) => s.id === body.scenario),
      "Choose a demo scenario.",
    );
    requireValue(
      ["Financial services", "Software company"].includes(str(body.template)),
      "Choose a company dataset.",
    );
    requireValue(
      Number.isInteger(body.seed) &&
        Number(body.seed) > 0 &&
        Number(body.seed) <= 1000000,
      "Use a seed between 1 and 1,000,000.",
    );
    requireValue(
      Number.isInteger(body.samples) &&
        Number(body.samples) >= 0 &&
        Number(body.samples) <= 40,
      "Generate between 0 and 40 sample requests.",
    );
    const required =
      body.scenario === "expired-approval"
        ? ["M3", "M4", "M5", "M6"]
        : ["M3", "M4", "M6"];
    requireValue(
      required.every((m) => arr(company.config.values.modules).includes(m)),
      `This scenario requires ${required.join(", ")} in company configuration.`,
    );
    state = await scenarioState(ctx, environment, {
      managed: true,
      scenario: body.scenario as ScenarioId,
      template: body.template as DemoTemplate,
      seed: Number(body.seed),
      samples: Number(body.samples),
      createdAt: Date.now(),
    });
  }
  company.environments.push(environment);
  company.version++;
  company.audit.unshift({
    id: uid("company-event"),
    version: 1,
    ts: Date.now(),
    actor: session.user,
    event:
      id === "restore"
        ? "Demo environment restored"
        : "Demo environment created",
    detail: environment,
    tenant: company.id,
  });
  ctx.directory.revision++;
  const output = {
    environment,
    scenario: state.demoWorkspace!.scenario,
    companyVersion: company.version,
  };
  ctx.directory.receipts[receiptKey] = { payload: payloadHash, data: output };
  const keys = Object.keys(ctx.directory.receipts);
  for (const key of keys.slice(0, Math.max(0, keys.length - 100)))
    delete ctx.directory.receipts[key];
  // Make the new state durable before exposing its name through the company registry.
  services.store.write(key, state);
  try {
    services.store.writeDirectory(ctx.directory);
  } catch (error) {
    // A flush can fail after the registry rename. Retain the state if its name is already visible.
    let exposed = true;
    try {
      exposed = !!services.store
        .readDirectory()
        ?.companies.find((c) => c.id === company.id)
        ?.environments.includes(environment);
    } catch {
      /* Preserve recoverable state when registry visibility is uncertain. */
    }
    if (!exposed) services.store.remove?.(key);
    throw error;
  }
  return ctx.respond(output, false);
}
