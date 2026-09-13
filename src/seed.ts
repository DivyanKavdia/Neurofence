import { legacySeed } from "./legacy-fixture";
import { arr, collections, Json, Row, State, str, uid } from "./types";

export function createState(
  legacy?: Record<string, unknown>,
  tenant = "acme",
): State {
  const old = legacy || legacySeed();
  const data = Object.fromEntries(
    collections.map((key) => [
      key,
      arr<Record<string, Json>>(old[key]).map((row) => ({
        ...row,
        id: str(row.id) || uid(key),
        version: Number(row.version) || 1,
      })),
    ]),
  ) as State["data"];
  const make = (id: string, values: Record<string, Json>): Row => ({
    id,
    version: 1,
    ...values,
  });
  data.policies = [
    make("baseline", {
      ...old.policy,
      name: "Enterprise baseline",
      status: "Active",
      history: [],
      draft: null,
      detectors: ["pii", "secrets", "injection"],
      responseAction: "redact",
      canary: 100,
    } as Record<string, Json>),
  ];
  data.policies[0].publishedVersion = data.policies[0].version;
  for (const p of data.projects) {
    p.policy = "baseline";
    p.keyStatus = p.keyStatus || "Active";
    p.keySuffix = str(p.key).slice(-4);
    delete p.key;
  }
  for (const r of data.routes) {
    r.status = "Active";
    r.publishedVersion = r.version;
    r.retries = 2;
    r.history = [];
    r.draft = null;
  }
  for (const b of data.budgets) {
    b.status = "Active";
    b.publishedVersion = b.version;
    b.currency = "INR";
    b.period = "Monthly";
    b.threshold = 80;
    b.action = b.hard ? "Block" : "Notify";
    b.rpm = 120;
    b.tokens = 100000;
    b.concurrency = 10;
    b.history = [];
    b.draft = null;
  }
  for (const a of data.agents) {
    a.allowedTools = Array.isArray(a.allowedTools)
      ? a.allowedTools
      : data.tools
          .filter(
            (t) =>
              t.status !== "Blocked" &&
              (t.action === "READ" || a.project === "finance"),
          )
          .map((t) => t.id);
    a.environment = "Development";
    a.dataScope = "Approved records";
    a.maxDuration = 3600;
    a.maxDepth = 3;
    a.workflow = uid("workflow");
    a.stepsUsed = 0;
    a.workflowStart = Date.now();
  }
  data.models = data.providers.map((p) =>
    make(`model-${p.id}`, {
      name: str(p.model),
      provider: p.id,
      region: str(p.region),
      status: "Approved",
      capabilities: ["Chat", "Streaming"],
      inputRate: 0.35,
      outputRate: 0.9,
    }),
  );
  data.servers = ["Claims MCP", "Finance MCP", "Knowledge MCP"].map((name, i) =>
    make(`server-${i}`, {
      name,
      endpoint: `https://${name.split(" ")[0].toLowerCase()}.example.test/mcp`,
      transport: "Streamable HTTP",
      auth: "OAuth broker",
      secret: `vault://demo/mcp-${i}`,
      status: "Approved",
      owner: "Platform team",
      risk: i === 1 ? "High" : "Low",
      provenance: "Verified sample",
      resources: ["Approved records"],
      prompts: ["Summarise record"],
    }),
  );
  for (const t of data.tools) {
    t.serverId =
      data.servers.find((s) => s.name === t.server)?.id || "server-0";
    t.expires = Date.now() + 30 * 86400000;
    t.parameters =
      t.id === "vendor.updateBankAccount"
        ? ["vendor_id", "account_ref"]
        : t.id === "knowledge.search"
          ? ["query"]
          : ["claim_id"];
  }
  data.assets = [
    ...data.projects.map((p) =>
      make(`asset-${p.id}`, {
        name: str(p.name),
        type: "Application",
        owner: str(p.owner),
        risk: "Medium",
        status: "Active",
        coverage: "Governed",
        linked: p.id,
        links: [str(p.route), str(p.policy), str(p.budget)],
        tags: ["production"],
        bomVersion: 1,
        bomHistory: [],
      }),
    ),
    ...data.agents.map((a) =>
      make(`asset-${a.id}`, {
        name: str(a.name),
        type: "Agent",
        owner: str(a.owner),
        risk: "High",
        status: "Active",
        coverage: "Governed",
        linked: a.id,
        links: [str(a.project), ...arr(a.allowedTools)],
        tags: ["agent"],
        bomVersion: 1,
        bomHistory: [],
      }),
    ),
    make("asset-shadow", {
      name: "Unmanaged research assistant",
      type: "Extension",
      owner: "Unassigned",
      risk: "High",
      status: "Discovered",
      coverage: "Unprotected",
      linked: "",
      links: [],
      tags: ["shadow-ai"],
      bomVersion: 1,
      bomHistory: [],
    }),
  ];
  data.detectors = [
    make("pii", {
      name: "Personal identifiers",
      stage: "Request + response",
      status: "Active",
      critical: true,
      latency: 12,
    }),
    make("secrets", {
      name: "API keys and secrets",
      stage: "Request + response",
      status: "Active",
      critical: true,
      latency: 8,
    }),
    make("injection", {
      name: "Prompt injection patterns",
      stage: "Request + tool",
      status: "Active",
      critical: true,
      latency: 15,
    }),
    make("content", {
      name: "Content safety sample",
      stage: "Response",
      status: "Active",
      critical: false,
      latency: 18,
    }),
  ];
  data.integrations = [
    make("siem", {
      name: "Security event export",
      type: "SIEM webhook",
      endpoint: "https://siem.example.test/events",
      secret: "vault://demo/siem",
      status: "Draft",
      lastTest: null,
    }),
  ];
  data.members = [
    make("member-admin", {
      name: "Divyan Kavdia",
      email: "admin@example.test",
      role: "Platform admin",
      status: "Active",
    }),
    make("member-security", {
      name: "Mira Kapoor",
      email: "security@example.test",
      role: "Security admin",
      status: "Active",
    }),
    make("member-developer", {
      name: "Priya Shah",
      email: "developer@example.test",
      role: "Developer",
      status: "Active",
    }),
  ];
  data.workforcePolicies = [
    make("wf-policy-personal", {
      name: "Personal AI upload protection",
      instance: "Personal account",
      activity: "File upload",
      action: "Block",
      status: "Active",
      justification: true,
    }),
  ];
  for (const w of data.workforce) {
    w.ts = Date.now();
    w.device = "Managed laptop";
    w.status =
      w.instance === "Enterprise tenant" ? "Sanctioned" : "Unsanctioned";
  }
  for (const t of data.traces) {
    t.workflow = t.workflow || uid("workflow");
    if (!Object.hasOwn(t, "budgetScope"))
      t.budgetScope =
        data.projects.find((p) => p.id === t.project)?.budget || null;
    t.budgetAttribution = t.budgetAttribution || "legacy-binding";
  }
  for (const i of data.incidents)
    i.notes = arr(i.notes).map((n) =>
      typeof n === "string"
        ? { text: n, ts: Date.now(), actor: "Sample review" }
        : n,
    );
  if (legacy)
    for (const approval of data.approvals) {
      if (["Pending", "Approved"].includes(str(approval.status))) {
        approval.status = "Cancelled";
        approval.reason =
          "Configuration migrated; request a fresh version-bound approval.";
      }
    }
  if (tenant !== "acme") {
    for (const k of collections)
      if (!["members", "detectors"].includes(k)) data[k] = [];
  }
  return {
    schema: 2,
    revision: 1,
    data,
    settings: make("settings", {
      name: tenant === "acme" ? "Acme Financial" : "Northstar Labs",
      retention: "Metadata only",
      days: 90,
      deployment: "SaaS",
      residency: "India",
      fourEyes: true,
      rawContent: false,
      modules: ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"],
      density: "Comfortable",
      controlPlane: "Healthy",
    }),
  };
}
