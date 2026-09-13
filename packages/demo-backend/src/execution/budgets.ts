import { budgetSpend, periodStart } from "@neurofence/contracts/ledger";
import {
  Json,
  num,
  Row,
  Session,
  State,
  str,
  uid,
} from "@neurofence/contracts/types";
import { canonical } from "../shared/values";
import { published } from "./policy";

export function evaluateBudget(
  state: State,
  project: Row,
  cost: number,
  body: Record<string, Json>,
): {
  ok: boolean;
  reason: string;
  decision?: string;
  budgetId?: string;
  route?: string;
  notify?: boolean;
} {
  let id = str(project.budget);
  const seen = new Set<string>();
  let route = "",
    notify = false;
  while (id && !seen.has(id)) {
    seen.add(id);
    const current = state.data.budgets.find((b) => b.id === id);
    const budget = current
      ? published(current, state.data.traces.length)
      : undefined;
    if (!budget || budget.status === "Draft")
      return {
        ok: false,
        reason: "Publish the bound budget before execution",
        decision: "DENY",
      };
    const used = budgetSpend(state, budget),
      start = periodStart(budget.period),
      scope = new Set([id]);
    for (let i = 0; i < state.data.budgets.length; i++)
      for (const child of state.data.budgets)
        if (scope.has(str(child.parent))) scope.add(child.id);
    const recent = state.data.traces.filter(
      (t) =>
        scope.has(str(t.budgetScope)) &&
        num(t.ts) > Math.max(start, Date.now() - 60000) &&
        t.executed,
    );
    if (
      (budget.hard || budget.action === "Block") &&
      used + cost > num(budget.limit)
    )
      return {
        ok: false,
        reason: `Hard budget reached: ${budget.name}`,
        decision: "DENY",
      };
    if (
      recent.length >= num(budget.rpm, 120) ||
      recent.reduce((n, t) => n + num(t.tokens), 0) + num(body.maxTokens) >
        num(budget.tokens, 100000) ||
      num(body.concurrency, 1) > num(budget.concurrency, 10)
    )
      return {
        ok: false,
        reason: `Request, token or concurrency quota reached: ${budget.name}`,
        decision: "THROTTLE",
      };
    if (used + cost >= (num(budget.limit) * num(budget.threshold, 80)) / 100) {
      if (budget.action === "Throttle")
        return {
          ok: false,
          reason: `Budget threshold throttled the request: ${budget.name}`,
          decision: "THROTTLE",
        };
      if (budget.action === "Circuit break")
        return {
          ok: false,
          reason: `Budget threshold stopped the workflow: ${budget.name}`,
          decision: "CIRCUIT_BREAK",
        };
      if (budget.action === "Require approval") {
        const fingerprint = canonical({
          project: project.id,
          projectVersion: project.version,
          budget: id,
          budgetVersion: budget.publishedVersion || budget.version,
          request: body,
        });
        const approval = state.data.approvals.find(
          (a) =>
            a.kind === "budget" &&
            a.fingerprint === fingerprint &&
            a.status === "Approved" &&
            num(a.expires) > Date.now(),
        );
        if (!approval)
          return {
            ok: false,
            reason: `Budget threshold requires a reviewed exception: ${budget.name}`,
            decision: "REQUIRE_APPROVAL",
            budgetId: id,
          };
      }
      if (budget.action === "Route" && budget.fallback)
        route = str(budget.fallback);
      if (budget.action === "Notify") notify = true;
    }
    id = str(budget.parent);
  }
  return {
    ok: true,
    reason: "Every applicable parent budget passed",
    route,
    notify,
  };
}

export function budgetApproval(
  state: State,
  session: Session,
  project: Row,
  trace: Row,
  body: Record<string, Json>,
  budgetId: string,
) {
  const budget = published(
    state.data.budgets.find((b) => b.id === budgetId)!,
    state.data.traces.length,
  );
  const fingerprint = canonical({
    project: project.id,
    projectVersion: project.version,
    budget: budgetId,
    budgetVersion: budget.publishedVersion || budget.version,
    request: body,
  });
  let approval = state.data.approvals.find(
    (a) =>
      a.kind === "budget" &&
      a.fingerprint === fingerprint &&
      ["Pending", "Denied"].includes(str(a.status)) &&
      num(a.expires) > Date.now(),
  );
  if (!approval) {
    approval = {
      id: uid("approval"),
      version: 1,
      kind: "budget",
      name: `${budget.name} · ${project.name}`,
      resource: budgetId,
      project: project.id,
      scope: "One exact request within the remaining hard limit",
      requestedBy: session.user,
      fingerprint,
      status: "Pending",
      trace: trace.id,
      expires: Date.now() + 3600000,
      ts: Date.now(),
    };
    state.data.approvals.unshift(approval);
  }
  trace.approvalId = approval.id;
  if (approval.status === "Denied") {
    trace.decision = "DENY";
    trace.reason = "The budget reviewer denied this exact request";
  }
}

export function consumeBudgetApprovals(
  state: State,
  project: Row,
  body: Record<string, Json>,
) {
  for (const current of state.data.budgets) {
    const budget = published(current, state.data.traces.length);
    const fingerprint = canonical({
      project: project.id,
      projectVersion: project.version,
      budget: budget.id,
      budgetVersion: budget.publishedVersion || budget.version,
      request: body,
    });
    const approval = state.data.approvals.find(
      (a) =>
        a.kind === "budget" &&
        a.fingerprint === fingerprint &&
        a.status === "Approved" &&
        num(a.expires) > Date.now(),
    );
    if (approval) {
      approval.status = "Used";
      approval.version++;
      approval.usedAt = Date.now();
    }
  }
}
