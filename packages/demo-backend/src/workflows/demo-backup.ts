import {
  DemoBackup,
  DemoBackupPayload,
  demoScenarios,
} from "@neurofence/contracts/demo";
import { collections, State, str } from "@neurofence/contracts/types";
import { PolicySuite } from "@neurofence/contracts/policy-lab";
import { canonical, hash, requireValue } from "../shared/values";
import { parsePolicyCases } from "./policy-lab";

function validateJson(value: unknown, depth = 0): void {
  requireValue(depth <= 20, "The snapshot is nested too deeply.");
  if (typeof value === "number")
    requireValue(Number.isFinite(value), "Snapshot numbers must be finite.");
  if (typeof value === "string")
    requireValue(
      value.length <= 32000,
      "A snapshot field exceeds the size limit.",
    );
  if (Array.isArray(value)) {
    requireValue(
      value.length <= 5000,
      "A snapshot list exceeds the size limit.",
    );
    value.forEach((v) => validateJson(v, depth + 1));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      requireValue(
        ![
          "__proto__",
          "prototype",
          "constructor",
          "gatewayReceipts",
          "permissions",
          "subject",
        ].includes(k),
        "Unsupported snapshot field.",
      );
      validateJson(v, depth + 1);
    }
  }
}

/** Snapshots are data, never credentials or company authority. */
function portable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(portable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).flatMap(([k, v]) => {
        if (
          /^(content|fingerprint|key|apiKey|api_key|password|authorization|accessToken|refreshToken)$/i.test(
            k,
          )
        )
          return [];
        if (k === "secret") return [[k, "vault://demo/restore-required"]];
        return [[k, portable(v)]];
      }),
    );
  return value;
}

export async function createDemoBackup(
  state: State,
  company: string,
  environment: string,
  companyVersion: number,
): Promise<DemoBackup> {
  requireValue(
    state.demoWorkspace?.managed,
    "Snapshots are available for environments created in Demo studio.",
  );
  requireValue(
    !Object.keys(state.gatewayReceipts || {}).length &&
      state.data.traces.every(
        (t) => !t.modelRuntime || t.modelRuntime === "mock",
      ),
    "Live execution records cannot be included in demo snapshots.",
  );
  const data = portable(structuredClone(state.data)) as State["data"];
  data.members = [];
  data.audit = [];
  data.distributions = [];
  data.jobs = [];
  for (const approval of data.approvals) {
    approval.status = "Cancelled";
    approval.reason = "Demo snapshot restore requires a fresh approval.";
    delete approval.args;
  }
  const payload: DemoBackupPayload = {
    format: "neurofence-demo",
    schema: 1,
    company,
    environment,
    createdAt: Date.now(),
    companyConfigVersion: companyVersion,
    demo: structuredClone(state.demoWorkspace!),
    data,
    ...(state.policyLab
      ? {
          policyLab: {
            suites: structuredClone(state.policyLab.suites),
            runs: [],
          },
        }
      : {}),
  };
  requireValue(
    new TextEncoder().encode(JSON.stringify(payload)).byteLength <= 750000,
    "The snapshot exceeds 750 KB. Reduce sample activity before exporting.",
  );
  return {
    payload,
    digest: await hash(canonical(JSON.parse(JSON.stringify(payload)))),
  };
}

export async function validateDemoBackup(
  value: unknown,
  company: string,
): Promise<DemoBackup> {
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    "Choose a valid demo snapshot.",
  );
  requireValue(
    new TextEncoder().encode(JSON.stringify(value)).byteLength <= 800000,
    "Choose a snapshot smaller than 800 KB.",
  );
  validateJson(value);
  const backup = value as DemoBackup,
    p = backup?.payload;
  requireValue(
    backup &&
      Object.keys(backup).every((k) => ["payload", "digest"].includes(k)),
    "Invalid snapshot envelope.",
  );
  requireValue(
    p?.format === "neurofence-demo" && p.schema === 1,
    "Choose a Neurofence demo snapshot, version 1.",
  );
  requireValue(
    Object.keys(p).every((k) =>
      [
        "format",
        "schema",
        "company",
        "environment",
        "createdAt",
        "companyConfigVersion",
        "demo",
        "data",
        "policyLab",
      ].includes(k),
    ),
    "Unknown snapshot field.",
  );
  requireValue(
    p.company === company,
    "This snapshot belongs to a different company.",
  );
  requireValue(
    typeof backup.digest === "string" &&
      backup.digest === (await hash(canonical(JSON.parse(JSON.stringify(p))))),
    "The snapshot checksum does not match. Re-export the original file.",
  );
  requireValue(
    typeof p.environment === "string" &&
      p.environment.length <= 80 &&
      Number.isFinite(p.createdAt),
    "Invalid snapshot origin.",
  );
  requireValue(
    p.demo?.managed === true &&
      demoScenarios.some((s) => s.id === p.demo.scenario) &&
      ["Financial services", "Software company"].includes(p.demo.template),
    "Invalid demo scenario metadata.",
  );
  requireValue(
    Number.isInteger(p.demo.seed) &&
      p.demo.seed > 0 &&
      p.demo.seed <= 1000000 &&
      Number.isInteger(p.demo.samples) &&
      p.demo.samples >= 0 &&
      p.demo.samples <= 40,
    "Invalid demo dataset settings.",
  );
  requireValue(
    p.data &&
      typeof p.data === "object" &&
      !Array.isArray(p.data) &&
      Object.keys(p.data).every((k) =>
        collections.includes(k as (typeof collections)[number]),
      ),
    "Invalid resource collections.",
  );
  let total = 0;
  for (const collection of collections) {
    const rows = p.data[collection];
    requireValue(
      Array.isArray(rows) && rows.length <= 1500,
      `Invalid ${collection} collection.`,
    );
    total += rows.length;
    requireValue(
      rows.every(
        (r) =>
          r &&
          typeof r.id === "string" &&
          r.id.length > 0 &&
          r.id.length <= 150 &&
          Number.isInteger(r.version) &&
          r.version >= 1,
      ),
      `Invalid ${collection} records.`,
    );
    requireValue(
      new Set(rows.map((r) => r.id)).size === rows.length,
      `Duplicate ${collection} identifiers.`,
    );
  }
  requireValue(total <= 5000, "A snapshot can contain at most 5,000 records.");
  requireValue(
    p.data.members.length === 0 &&
      p.data.audit.length === 0 &&
      p.data.jobs.length === 0 &&
      p.data.distributions.length === 0,
    "Snapshots cannot replace memberships, audit, jobs or policy distribution authority.",
  );
  requireValue(
    p.data.traces.every((t) => !t.modelRuntime || t.modelRuntime === "mock"),
    "Live traces cannot be restored into a demo.",
  );
  const has = (c: (typeof collections)[number], id: unknown) =>
    p.data[c].some((r) => r.id === id);
  for (const project of p.data.projects)
    requireValue(
      has("routes", project.route) &&
        has("policies", project.policy) &&
        has("budgets", project.budget),
      "An application binding is missing from the snapshot.",
    );
  for (const route of p.data.routes)
    requireValue(
      has("providers", route.primary) &&
        (!route.fallback || has("providers", route.fallback)),
      "A route provider is missing from the snapshot.",
    );
  for (const agent of p.data.agents)
    requireValue(
      has("projects", agent.project),
      "An agent's application is missing from the snapshot.",
    );
  for (const budget of p.data.budgets) {
    const seen = new Set<string>();
    let current = budget;
    while (current) {
      requireValue(
        !seen.has(current.id),
        "Budget hierarchy cannot contain a cycle.",
      );
      seen.add(current.id);
      if (!current.parent) break;
      requireValue(
        has("budgets", current.parent),
        "A budget parent is missing from the snapshot.",
      );
      current = p.data.budgets.find((b) => b.id === current.parent)!;
    }
  }
  if (p.policyLab) {
    requireValue(
      Array.isArray(p.policyLab.suites) &&
        p.policyLab.suites.length <= 12 &&
        Array.isArray(p.policyLab.runs) &&
        p.policyLab.runs.length === 0,
      "Invalid saved test suites.",
    );
    requireValue(
      new Set(p.policyLab.suites.map((s) => s.id)).size ===
        p.policyLab.suites.length,
      "Duplicate test suite identifiers.",
    );
    for (const s of p.policyLab.suites) {
      requireValue(
        s &&
          typeof s.id === "string" &&
          /^[a-zA-Z0-9_-]{1,80}$/.test(s.id) &&
          Number.isInteger(s.version) &&
          s.version >= 1 &&
          typeof s.name === "string" &&
          s.name.trim().length > 0 &&
          s.name.length <= 100 &&
          s.syntheticOnly === true &&
          has("policies", s.policy),
        "Invalid saved test suite.",
      );
      s.cases = parsePolicyCases(s.cases);
    }
  }
  return structuredClone(backup);
}

export function restoreDemoData(
  backup: DemoBackup,
  state: State,
  owner: string,
  member: string,
  environment: string,
): State {
  state.data = portable(backup.payload.data) as State["data"];
  for (const row of [
    ...state.data.projects,
    ...state.data.agents,
    ...state.data.assets,
  ])
    row.owner = owner;
  for (const agent of state.data.agents) agent.environment = environment;
  for (const approval of state.data.approvals) {
    approval.status = "Cancelled";
    delete approval.fingerprint;
  }
  for (const collection of ["policies", "routes", "budgets"] as const)
    for (const row of state.data[collection])
      if (row.draft) {
        row.status = Number(row.publishedVersion) ? "Active" : "Draft";
        row.reviewedBy = "";
      }
  state.policyLab = {
    suites: (backup.payload.policyLab?.suites || []).map(
      (s): PolicySuite => ({
        id: s.id,
        version: s.version,
        name: s.name,
        policy: s.policy,
        syntheticOnly: true,
        owner: member,
        updatedAt: Date.now(),
        cases: s.cases,
      }),
    ),
    runs: [],
  };
  state.demoWorkspace = {
    managed: true,
    scenario: backup.payload.demo.scenario,
    template: backup.payload.demo.template,
    seed: backup.payload.demo.seed,
    samples: backup.payload.demo.samples,
    createdAt: Date.now(),
    restoredFrom: str(backup.payload.environment),
  };
  return state;
}
