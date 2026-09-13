import { agentLimit } from "./authority";
import { distributionFailure } from "../workflows/distribution";
import { createTrace } from "./trace";

import { budgetSpend } from "@neurofence/contracts/ledger";
import {
  ProviderConnector,
  ProviderFailure,
} from "@neurofence/contracts/provider";
import {
  Collection,
  arr,
  Json,
  num,
  round,
  Row,
  Session,
  State,
  str,
  uid,
} from "@neurofence/contracts/types";
import { mask, requireValue } from "../shared/values";
import {
  evaluateBudget,
  budgetApproval,
  consumeBudgetApprovals,
} from "./budgets";
import { inspect } from "./inspect";
import { published } from "./policy";

export async function runModel(
  providerConnector: ProviderConnector | undefined,
  state: State,
  session: Session,
  body: Record<string, Json>,
  find: (c: Collection, id: string) => Row,
  audit: (e: string, d: string, r?: string) => void,
  checkpoint?: (trace: Row) => void,
): Promise<Row> {
  const project = find("projects", str(body.project)),
    trace = createTrace("model", session, project),
    stages: Json[] = [];
  trace.stages = stages;
  trace.modelRuntime = providerConnector?.mode || "mock";
  const stage = (name: string, detail: string, status = "Passed") =>
    stages.push({ name, detail, status });
  const deny = (reason: string) => {
    trace.decision = "DENY";
    trace.reason = reason;
    stage("Execution stopped", reason, "Blocked");
    return trace;
  };
  const distributionError = distributionFailure(state);
  if (distributionError) return deny(distributionError);
  const agent = body.agent ? find("agents", str(body.agent)) : undefined;
  if (agent) {
    trace.agent = agent.id;
    trace.workflow = agent.workflow;
    if (agent.project !== project.id)
      return deny("Agent belongs to another application");
    if (providerConnector)
      return deny(
        "Agent model grants currently execute in the mock runtime; operator model binding is required for live execution",
      );
    const limit = agentLimit(
      state,
      agent,
      session.environment,
      trace.workflow,
      0,
      true,
    );
    if (limit) return deny(limit);
  }
  if (project.keyExpires && num(project.keyExpires) <= Date.now())
    return deny("Application credential expired");
  if (project.status !== "Active" || project.keyStatus !== "Active")
    return deny("Application or virtual credential is inactive");
  stage("Identity", `${project.name} · ${session.user}`);
  const policy = published(
      find("policies", str(project.policy)),
      state.data.traces.length,
    ),
    route = published(
      find("routes", str(project.route)),
      state.data.traces.length,
    );
  trace.policyVersion = num(policy.publishedVersion, policy.version);
  trace.decisionId = uid("decision");
  if (
    !["Active", "Canary"].includes(str(policy.status)) ||
    !["Active", "Canary"].includes(str(route.status))
  )
    return deny("Publish the bound route and policy first");
  if (state.settings.controlPlane === "Unavailable")
    stage("Policy cache", "Using the last published policy snapshot", "Cached");
  const text = str(body.prompt),
    maxTokens = num(body.maxTokens, 1200);
  requireValue(text.trim(), "Enter a prompt.");
  requireValue(
    text.length <= 200_000 && Number.isInteger(maxTokens),
    "Use a prompt below 200,000 characters and an integer output limit.",
  );
  if (providerConnector) {
    requireValue(
      !body.failure || body.failure === "none",
      "Provider failure presets are available in mock runtime. LiteLLM reports actual execution errors.",
    );
    requireValue(
      Object.keys(body).every((k) =>
        ["project", "prompt", "maxTokens", "streaming", "failure"].includes(k),
      ),
      "Unsupported model request field.",
    );
  }
  if (maxTokens < 1 || maxTokens > num(policy.maxTokens))
    return deny("Requested output exceeds the active policy token limit");
  const inspection = inspect(text, policy, state);
  trace.preview = mask(inspection.text);
  trace.signals = inspection.signals;
  trace.findings = inspection.findings;
  stage("Request guardrails", inspection.reason, inspection.decision);
  if (inspection.decision === "DENY") return deny(inspection.reason);
  const eligible = (id: string) => {
    const p = state.data.providers.find((p) => p.id === id);
    return (
      p &&
      p.status === "Healthy" &&
      state.data.models.some(
        (m) => m.provider === id && m.status === "Approved",
      ) &&
      (!agent ||
        state.data.models.some(
          (m) =>
            m.provider === id &&
            m.status === "Approved" &&
            arr(agent.allowedModels).includes(m.id),
        )) &&
      (!providerConnector ||
        (providerConnector.eligible(id, session, str(policy.region)) &&
          state.data.models.some(
            (m) => m.provider === id && m.status === "Approved",
          ))) &&
      (policy.region === "Any region" || str(p.region).startsWith("India"))
    );
  };
  const b = state.data.budgets.find((b) => b.id === project.budget),
    used = b ? budgetSpend(state, b) : 0;
  const preflight = evaluateBudget(state, project, 0, body);
  const low =
    !!b &&
    ((num(b.limit) - used) / Math.max(1, num(b.limit))) * 100 <
      num(route.threshold);
  const fallback = preflight.route || str(route.fallback);
  const candidates = (
    low || preflight.route
      ? [fallback, str(route.primary)]
      : [str(route.primary), fallback]
  ).filter((id, i, a) => id && a.indexOf(id) === i && eligible(id));
  if (!candidates.length)
    return deny(
      "No healthy model deployment meets the active residency policy",
    );
  let selected = "",
    estimate = 0,
    blocked = preflight;
  for (const id of candidates) {
    const cost = providerConnector
        ? providerConnector.quote(id, inspection.text, maxTokens)
        : round(
            Math.max(0.01, (maxTokens / 1000) * (id === fallback ? 0.35 : 0.9)),
          ),
      check = evaluateBudget(state, project, cost, body);
    if (check.ok) {
      if (check.route && check.route !== id) {
        if (eligible(check.route) && !candidates.includes(check.route))
          candidates.push(check.route);
        blocked = {
          ok: false,
          reason:
            "The budget threshold requires its configured eligible fallback",
          decision: "DENY",
        };
        continue;
      }
      selected = id;
      estimate = cost;
      blocked = check;
      break;
    }
    blocked = check;
  }
  if (!selected) {
    trace.decision = blocked.decision || "DENY";
    trace.reason = blocked.reason;
    stage("Budget preflight", blocked.reason, trace.decision as string);
    if (blocked.budgetId)
      budgetApproval(state, session, project, trace, body, blocked.budgetId);
    return trace;
  }
  if (agent) {
    const limit = agentLimit(
      state,
      agent,
      session.environment,
      trace.workflow,
      estimate,
      true,
    );
    if (limit) return deny(limit);
    agent.stepsUsed = num(agent.stepsUsed) + 1;
  }
  if (blocked.notify)
    stage("Budget notification", "The configured threshold alert was recorded");
  consumeBudgetApprovals(state, project, body);
  stage(
    "Budget reservation",
    `INR ${estimate.toFixed(2)} reserved across the applicable budget hierarchy`,
  );
  trace.provider = selected;
  trace.target =
    state.data.providers.find((p) => p.id === selected)?.model || selected;
  stage(
    "Route",
    `${selected === route.primary ? "Primary" : "Fallback"} · ${trace.target}`,
  );
  if (!providerConnector && body.failure === "timeout") {
    trace.reason =
      "Provider timeout; conservative estimate held pending reconciliation";
    trace.decision = "ERROR";
    trace.reservation = estimate;
    trace.cost = estimate;
    trace.pendingCost = true;
    trace.executed = true;
    stage("Provider", "Simulated timeout; charge pending", "Pending");
    trace.jobId = uid("job");
    state.data.jobs.push({
      id: str(trace.jobId),
      version: 1,
      collection: "traces",
      resource: trace.id,
      status: "Running",
      startedAt: Date.now(),
      readyAt: Date.now() + 1800,
    });
    return trace;
  }
  let output: string;
  if (providerConnector) {
    trace.executed = true;
    trace.decision = "ERROR";
    trace.reason =
      "Provider execution in progress; reservation held until a verified result is recorded";
    trace.cost = estimate;
    trace.reservation = estimate;
    trace.pendingCost = true;
    checkpoint!(trace);
    try {
      const reply = await providerConnector.execute({
        provider: selected,
        prompt: inspection.text,
        maxTokens,
        traceId: trace.id,
        project: project.id,
        policyVersion: num(trace.policyVersion),
        session,
      });
      output = reply.content;
      trace.target = reply.model;
      trace.upstreamRequestId = reply.requestId;
      trace.cost = reply.costInr;
      trace.inputTokens = reply.inputTokens;
      trace.outputTokens = reply.outputTokens;
      trace.tokens = reply.inputTokens + reply.outputTokens;
      trace.ms = reply.elapsedMs;
      trace.pendingCost = false;
      trace.billingBasis = "Reported tokens × operator-configured INR rates";
      stage(
        "Provider execution",
        "LiteLLM text completion buffered for response inspection",
      );
    } catch (error) {
      const unknown =
        !(error instanceof ProviderFailure) || error.outcome === "unknown";
      trace.reason =
        error instanceof ProviderFailure
          ? error.message
          : "Provider outcome is unknown; reconcile this trace before retrying";
      trace.executed = unknown;
      trace.cost = unknown ? estimate : 0;
      trace.reservation = unknown ? estimate : 0;
      trace.pendingCost = unknown;
      stage(
        "Provider execution",
        str(trace.reason),
        unknown ? "Pending" : "Failed",
      );
      return trace;
    }
  } else {
    trace.executed = true;
    trace.cost = round(Math.max(0.01, estimate * 0.76));
    trace.tokens = Math.ceil(text.length / 4) + Math.floor(maxTokens * 0.73);
    trace.ms = selected === route.primary ? 847 : 618;
    output = text.includes("[demo:response-pii]")
      ? "Demo response: customer 123456789012 requires review."
      : `Demo response for ${project.name}: review the approved records and refer exceptions to the assigned reviewer.`;
    stage(
      "Provider execution",
      body.streaming
        ? `Simulated ${policy.streaming} stream`
        : "Sample provider response",
    );
  }
  trace.decision =
    selected === route.primary ? inspection.decision : "ROUTE_ALTERNATE";
  trace.reason =
    selected === route.primary
      ? inspection.reason
      : "An eligible fallback met policy and budget constraints";
  if (policy.response) {
    const response = inspect(
      output,
      { ...policy, pii: policy.responseAction || policy.pii },
      state,
      "Response",
    );
    trace.responseFindings = response.findings;
    stage("Response guardrails", response.reason, response.decision);
    if (response.decision === "DENY") {
      trace.decision = "DENY";
      trace.reason = "Response withheld; provider usage remains billable";
      output = "";
    } else {
      output = response.text;
      if (response.decision === "REDACT") trace.decision = "REDACT";
    }
  }
  trace.output = output;
  trace.reservation = 0;
  stage(
    "Usage and evidence",
    `INR ${trace.cost} committed; remaining reservation released`,
  );
  if (state.settings.rawContent)
    trace.content = { prompt: text, response: output };
  if (!state.data.assets.some((a) => a.linked === project.id))
    state.data.assets.push({
      id: uid("asset"),
      version: 1,
      name: project.name,
      type: "Application",
      owner: project.owner,
      risk: "Low",
      status: "Active",
      coverage: "Governed",
      linked: project.id,
      links: [project.route || "", project.policy || "", project.budget || ""],
      bomVersion: 1,
      bomHistory: [],
    });
  return trace;
}
