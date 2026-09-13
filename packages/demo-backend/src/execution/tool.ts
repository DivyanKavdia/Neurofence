import { createTrace } from "./trace";

import {
  arr,
  Collection,
  Json,
  num,
  obj,
  Row,
  Session,
  State,
  str,
  uid,
} from "@neurofence/contracts/types";
import { canonical, mask, requireValue } from "../shared/values";
import {
  evaluateBudget,
  budgetApproval,
  consumeBudgetApprovals,
} from "./budgets";
import { inspect } from "./inspect";
import { published } from "./policy";

export function runTool(
  state: State,
  session: Session,
  body: Record<string, Json>,
  find: (c: Collection, id: string) => Row,
  audit: (e: string, d: string, r?: string) => void,
): Row {
  const agent = find("agents", str(body.agent)),
    project = find("projects", str(agent.project)),
    tool = find("tools", str(body.tool)),
    trace = createTrace("tool", session, project),
    stages: Json[] = [];
  trace.stages = stages;
  trace.agent = agent.id;
  trace.target = tool.id;
  trace.workflow = agent.workflow || uid("workflow");
  trace.delegation = [session.user, project.id, agent.id, tool.id];
  const stage = (name: string, detail: string, status = "Passed") =>
    stages.push({ name, detail, status });
  const deny = (reason: string) => {
    trace.decision = "DENY";
    trace.reason = reason;
    stage("Execution stopped", reason, "Blocked");
    return trace;
  };
  const policy = published(
    find("policies", str(project.policy)),
    state.data.traces.length,
  );
  trace.policyVersion = num(policy.publishedVersion, policy.version);
  trace.decisionId = uid("decision");
  if (
    agent.status !== "Active" ||
    project.status !== "Active" ||
    project.keyStatus !== "Active"
  )
    return deny("Agent or application access is suspended");
  if (
    num(agent.stepsUsed) >= num(agent.maxSteps) ||
    Date.now() - num(agent.workflowStart) >
      num(agent.maxDuration, 3600) * 1000 ||
    num(body.depth, 1) > num(agent.maxDepth, 3)
  )
    return deny("Agent workflow circuit breaker reached");
  if (
    tool.status === "Blocked" ||
    tool.status === "Pending" ||
    num(tool.expires, Date.now() + 1) <= Date.now()
  )
    return deny("Tool permission is blocked, pending or expired");
  if (!arr(agent.allowedTools).includes(tool.id))
    return deny("This tool is not granted to the agent");
  const args = obj(body.args);
  requireValue(
    body.args && typeof body.args === "object" && !Array.isArray(body.args),
    "Tool arguments must be a JSON object.",
  );
  trace.preview = mask(JSON.stringify(args));
  const parameters = arr<string>(tool.parameters);
  if (
    Object.keys(args).some((k) => !parameters.includes(k)) ||
    parameters.some((k) => !str(args[k]).trim())
  )
    return deny("Arguments do not match the approved tool schema");
  const resource = str(
      args.vendor_id || args.claim_id || args.record_id || args.query,
    ),
    scope = str(tool.scope);
  if (
    tool.id !== "knowledge.search" &&
    !(scope.endsWith("*")
      ? resource.startsWith(scope.slice(0, -1))
      : resource === scope)
  )
    return deny("The resource is outside the approved tool scope");
  if (
    tool.id === "vendor.updateBankAccount" &&
    (project.id !== "finance" ||
      !/^demo-account-[A-Za-z0-9-]+$/.test(str(args.account_ref)))
  )
    return deny(
      "Financial update requires the finance application and an approved account reference",
    );
  const check = inspect(JSON.stringify(args), policy, state);
  if (check.decision === "DENY") return deny(check.reason);
  stage("Identity and delegation", arr(trace.delegation).join(" → "));
  stage("Tool and resource scope", `${tool.action} · ${scope}`);
  let approval: Row | undefined;
  if (tool.status === "Approval required" || tool.action !== "READ") {
    const fingerprint = canonical({
      agent: agent.id,
      tool: tool.id,
      args,
      workflow: trace.workflow || "",
      policy: trace.policyVersion || 0,
      agentVersion: agent.version,
      toolVersion: tool.version,
      projectVersion: project.version,
    });
    const matches = state.data.approvals.filter(
      (a) => a.fingerprint === fingerprint && num(a.expires) > Date.now(),
    );
    if (matches.some((a) => a.status === "Denied"))
      return deny("The reviewer denied this exact request");
    approval = matches.find((a) => a.status === "Approved");
    if (!approval) {
      let pending = matches.find((a) => a.status === "Pending");
      if (!pending) {
        pending = {
          id: uid("approval"),
          version: 1,
          kind: "tool",
          name: `${tool.name} · ${scope}`,
          agent: agent.id,
          project: project.id,
          tool: tool.id,
          args,
          workflow: trace.workflow,
          policyVersion: trace.policyVersion,
          requestedBy: session.user,
          fingerprint,
          status: "Pending",
          trace: trace.id,
          scope,
          expires: Math.min(num(tool.expires), Date.now() + 86400000),
          ts: Date.now(),
        };
        state.data.approvals.unshift(pending);
        audit("Requested tool approval", str(tool.name), pending.id);
      }
      trace.decision = "REQUIRE_APPROVAL";
      trace.reason = "Review required before this exact request can execute";
      trace.approvalId = pending.id;
      stage("Human approval", "Waiting; no execution or charge", "Pending");
      return trace;
    }
  }
  const budget = evaluateBudget(state, project, 0.08, body);
  if (!budget.ok) {
    trace.decision = budget.decision || "DENY";
    trace.reason = budget.reason;
    stage("Budget preflight", budget.reason, trace.decision as string);
    if (budget.budgetId)
      budgetApproval(state, session, project, trace, body, budget.budgetId);
    return trace;
  }
  consumeBudgetApprovals(state, project, body);
  if (approval) {
    approval.status = "Used";
    approval.version++;
    approval.usedAt = Date.now();
    trace.approvalId = approval.id;
    stage("Single-use approval", approval.id);
  }
  agent.stepsUsed = num(agent.stepsUsed) + 1;
  trace.executed = true;
  trace.cost = 0.08;
  trace.ms = 126;
  trace.decision = check.decision;
  trace.reason = approval
    ? "Approved request executed once within its resource scope"
    : "Read allowed within the approved resource scope";
  trace.output =
    "Demo tool result: approved sample record processed. No external system was changed.";
  stage("Budget", "INR 0.08 within all applicable limits");
  stage(
    "Credential broker",
    "Scoped sample credential; upstream secret never exposed",
  );
  stage("Tool execution", "Sample result");
  stage("Evidence", "Delegation, policy version and usage recorded");
  return trace;
}
