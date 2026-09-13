import { arr, num, Row, State, str } from "@neurofence/contracts/types";

export function scopeAllows(
  scope: unknown,
  resource: string,
  approvedToolScope: string,
) {
  const value = str(scope).trim();
  if (value === "Approved records") return !!approvedToolScope;
  return (
    !!value &&
    (value.endsWith("*")
      ? resource.startsWith(value.slice(0, -1))
      : resource === value)
  );
}

export function workflowCost(state: State, workflow: unknown) {
  return state.data.traces
    .filter((t) => t.workflow === workflow)
    .reduce((sum, t) => sum + num(t.cost), 0);
}

export function agentLimit(
  state: State,
  agent: Row,
  environment: string,
  workflow: unknown,
  estimate: number,
  modelCall = false,
) {
  if (
    agent.status !== "Active" ||
    (agent.environment && agent.environment !== environment)
  )
    return "Agent access or environment is outside the registered authority";
  if (
    Date.now() - num(agent.workflowStart) >
      num(agent.maxDuration, 3600) * 1000 ||
    num(agent.stepsUsed) >= num(agent.maxSteps)
  )
    return "Agent workflow circuit breaker reached";
  if (workflowCost(state, workflow) + estimate > num(agent.maxCost, 10))
    return "Agent workflow cost limit reached";
  const calls = state.data.traces.filter(
    (t) =>
      t.workflow === workflow &&
      t.kind === "model" &&
      (t.executed || t.pendingCost),
  ).length;
  if (modelCall && calls >= num(agent.maxModelCalls, 10))
    return "Agent workflow model-call limit reached";
  return "";
}

export function delegationChain(state: State, root: Row, ids: string[]) {
  const chain = [root];
  for (const id of ids) {
    const previous = chain.at(-1)!;
    const delegate = state.data.agents.find((a) => a.id === id);
    if (
      !delegate ||
      chain.some((a) => a.id === id) ||
      !arr(previous.allowedDelegates).includes(id) ||
      delegate.project !== root.project
    )
      return null;
    chain.push(delegate);
  }
  if (chain.some((a) => chain.length > num(a.maxDepth, 3))) return null;
  return chain;
}
