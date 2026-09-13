// v0.3 fixtures retained for faithful saved-data migration.
// @ts-nocheck
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function legacySeed() {
  const now = Date.now();
  const s = {
    schema: 1,
    providers: [
      {
        id: "azure",
        name: "Azure OpenAI",
        type: "Azure OpenAI",
        region: "India Central",
        model: "Chat Pro",
        symbol: "Az",
        status: "Healthy",
        secret: "vault://demo/azure",
      },
      {
        id: "vertex",
        name: "Vertex AI",
        type: "Google Vertex AI",
        region: "India West",
        model: "Chat Economy",
        symbol: "G",
        status: "Healthy",
        secret: "vault://demo/vertex",
      },
      {
        id: "anthropic",
        name: "Anthropic",
        type: "Anthropic",
        region: "Global",
        model: "Reasoning",
        symbol: "A",
        status: "Healthy",
        secret: "vault://demo/anthropic",
      },
      {
        id: "local",
        name: "Private inference",
        type: "Self-hosted",
        region: "India Central",
        model: "Private Model",
        symbol: "P",
        status: "Healthy",
        secret: "vault://demo/private",
      },
    ],
    projects: [
      {
        id: "claims",
        name: "Claims copilot",
        owner: "Priya Shah",
        budget: "b-claims",
        route: "india",
        status: "Active",
        key: "nf_demo_claims_7xk42",
      },
      {
        id: "support",
        name: "Customer support",
        owner: "Rahul Mehta",
        budget: "b-support",
        route: "india",
        status: "Active",
        key: "nf_demo_support_9qp81",
      },
      {
        id: "finance",
        name: "Finance assistant",
        owner: "Ananya Rao",
        budget: "b-finance",
        route: "india",
        status: "Active",
        key: "nf_demo_finance_4mt26",
      },
    ],
    routes: [
      {
        id: "india",
        name: "India standard",
        alias: "enterprise-chat",
        primary: "azure",
        fallback: "vertex",
        threshold: 20,
        version: 3,
      },
    ],
    policy: {
      name: "Enterprise baseline",
      version: 3,
      mode: "enforce",
      pii: "redact",
      injection: "block",
      region: "India only",
      response: true,
      streaming: "strict_buffered",
      maxTokens: 4096,
    },
    policyHistory: [],
    policyDraft: null,
    budgets: [
      {
        id: "org",
        name: "Acme Financial",
        parent: null,
        limit: 1000,
        hard: true,
      },
      {
        id: "b-claims",
        name: "Claims",
        parent: "org",
        limit: 120,
        hard: true,
      },
      {
        id: "b-support",
        name: "Customer support",
        parent: "org",
        limit: 100,
        hard: true,
      },
      {
        id: "b-finance",
        name: "Finance",
        parent: "org",
        limit: 80,
        hard: true,
      },
    ],
    agents: [
      {
        id: "claims-agent",
        name: "Claims review agent",
        owner: "Priya Shah",
        purpose: "Read and summarise claim records for a human reviewer.",
        project: "claims",
        status: "Active",
        maxSteps: 20,
      },
      {
        id: "finance-agent",
        name: "Finance operations agent",
        owner: "Ananya Rao",
        purpose: "Review invoices and request vendor account changes.",
        project: "finance",
        status: "Active",
        maxSteps: 12,
      },
      {
        id: "support-agent",
        name: "Support assistant",
        owner: "Rahul Mehta",
        purpose: "Retrieve approved support articles.",
        project: "support",
        status: "Active",
        maxSteps: 30,
      },
    ],
    tools: [
      {
        id: "claims.read",
        name: "claims.read",
        server: "Claims MCP",
        action: "READ",
        scope: "CLAIM-*",
        status: "Approved",
        risk: "Low",
        description: "Read a claim record from the approved claims system.",
      },
      {
        id: "vendor.updateBankAccount",
        name: "vendor.updateBankAccount",
        server: "Finance MCP",
        action: "UPDATE",
        scope: "VENDOR-042",
        status: "Approval required",
        risk: "Critical",
        description:
          "Update one approved vendor bank account. Each execution needs a separate approval.",
      },
      {
        id: "claims.delete",
        name: "claims.delete",
        server: "Claims MCP",
        action: "DELETE",
        scope: "None",
        status: "Blocked",
        risk: "Critical",
        description:
          "Delete a claim record. Denied by the enterprise baseline.",
      },
      {
        id: "knowledge.search",
        name: "knowledge.search",
        server: "Knowledge MCP",
        action: "READ",
        scope: "approved-articles",
        status: "Approved",
        risk: "Low",
        description: "Search the internal, approved support knowledge base.",
      },
    ],
    traces: [],
    approvals: [],
    incidents: [],
    audit: [],
    workforce: [
      {
        id: "wf1",
        app: "ChatGPT",
        instance: "Personal account",
        user: "Neha S.",
        activity: "File upload",
        classification: "Customer identifiers",
        action: "Block",
        events: 12,
      },
      {
        id: "wf2",
        app: "Microsoft Copilot",
        instance: "Enterprise tenant",
        user: "Rahul M.",
        activity: "Prompt",
        classification: "Internal content",
        action: "Allow",
        events: 35,
      },
      {
        id: "wf3",
        app: "Claude Desktop",
        instance: "Unknown account",
        user: "Amit K.",
        activity: "Paste",
        classification: "Source code",
        action: "Coach",
        events: 8,
      },
    ],
    assurance: [],
    settings: { retention: "Metadata only", days: 90 },
    changed: 0,
  };
  for (let i = 0; i < 64; i++) {
    const pr = s.projects[i % 3],
      tool = i % 5 === 0,
      denied = i % 13 === 0,
      redacted = !tool && !denied && i % 7 === 0;
    const ts =
      now -
      (i < 18
        ? i * 37 * 60000
        : (1 + Math.floor((i - 18) / 8)) * 86400000 + (i % 8) * 3000000);
    s.traces.push({
      id: "tr-demo-" + String(64 - i).padStart(3, "0"),
      ts,
      project: pr.id,
      budgetScope: pr.budget,
      budgetAttribution: "sample",
      principal: pr.owner,
      kind: tool ? "tool" : "model",
      target: tool ? "claims.read" : i % 4 ? "Chat Pro" : "Chat Economy",
      provider: tool ? null : i % 4 ? "azure" : "vertex",
      decision: denied ? "DENY" : redacted ? "REDACT" : "ALLOW",
      reason: denied
        ? "Sensitive upload blocked by policy"
        : redacted
          ? "Sensitive identifiers redacted"
          : "Identity, policy and budget checks passed",
      cost: denied ? 0 : tool ? 0.08 : round(0.48 + (i % 9) * 0.27),
      tokens: tool || denied ? 0 : 640 + (i % 9) * 341,
      ms: denied ? 18 : tool ? 112 : 740 + i * 7,
      policyVersion: 3,
      executed: !denied,
      preview: denied
        ? "[SENSITIVE CONTENT]"
        : tool
          ? "Read approved claim record"
          : "Summarise the approved support document.",
      stages: [],
    });
  }
  s.incidents = [
    {
      id: "INC-1042",
      title: "Destructive tool call blocked",
      severity: "Critical",
      source: "Agent & MCP",
      agent: "claims-agent",
      trace: s.traces[0].id,
      status: "Open",
      owner: "Security team",
      ts: now - 480000,
      reason: "The agent attempted an action outside its approved read scope.",
      notes: [],
    },
    {
      id: "INC-1041",
      title: "Sensitive data in a personal AI upload",
      severity: "High",
      source: "Workforce AI",
      agent: null,
      trace: s.traces[13].id,
      status: "Open",
      owner: "SOC team",
      ts: now - 1800000,
      reason:
        "Customer identifiers were detected before an upload to a personal AI account.",
      notes: [],
    },
    {
      id: "INC-1040",
      title: "Repeated request pattern reviewed",
      severity: "Medium",
      source: "AI Gateway",
      agent: "support-agent",
      trace: s.traces[26].id,
      status: "Resolved",
      owner: "Rahul Mehta",
      ts: now - 86400000,
      reason:
        "A retry loop was investigated and the client configuration was corrected.",
      notes: ["Resolved in the sample dataset."],
    },
  ];
  s.traces[0].target = "claims.delete";
  s.traces[0].kind = "tool";
  s.traces[0].reason = s.incidents[0].reason;
  s.traces[0].cost = 0;
  s.traces[0].tokens = 0;
  s.traces[0].decision = "DENY";
  s.traces[0].executed = false;
  s.traces[0].provider = null;
  s.audit = [
    {
      id: "ev-demo-001",
      ts: now - 3600000,
      actor: "Security team",
      event: "Published enterprise baseline v3",
      detail: "Request and response checks enabled. India residency enforced.",
    },
    {
      id: "ev-demo-002",
      ts: now - 5400000,
      actor: "Platform team",
      event: "Published India standard route v3",
      detail:
        "Primary Chat Pro; fallback Chat Economy. Both India deployments.",
    },
  ];
  return normalizeState(s);
}
function defaultAgentTools(s, project) {
  return s.tools
    .filter(
      (t) =>
        t.status !== "Blocked" &&
        (t.action === "READ" ||
          (t.action === "UPDATE" && project === "finance")),
    )
    .map((t) => t.id);
}
function normalizeState(s) {
  for (const t of s.traces) {
    if (!Object.hasOwn(t, "budgetScope")) {
      t.budgetScope =
        s.projects.find((p) => p.id === t.project)?.budget || null;
      t.budgetAttribution = "legacy-binding";
    }
  }
  for (const a of s.agents) {
    if (!Array.isArray(a.allowedTools))
      a.allowedTools = defaultAgentTools(s, a.project);
  }
  for (const i of s.incidents) if (!Array.isArray(i.notes)) i.notes = [];
  return s;
}
