import { arr, num, Row, State, str } from "@neurofence/contracts/types";

/** Company controls supplement the application's independently published policy. */
export function companyPolicy(state: State, policy: Row): Row {
  const effective = { ...policy };
  if (state.settings.residency === "India") effective.region = "India";
  effective.maxTokens = Math.min(
    num(policy.maxTokens, 4000),
    num(state.settings.maxTokens, 4000),
  );
  const detectors = new Set(arr<string>(policy.detectors));
  if (state.settings.mandatoryPii) {
    detectors.add("pii");
    effective.pii = policy.pii === "block" ? "block" : "redact";
    effective.responseAction =
      policy.responseAction === "block" ? "block" : "redact";
    effective.mode = "enforce";
    effective.response = true;
  }
  if (state.settings.mandatoryInjection) {
    detectors.add("injection");
    effective.injection = "block";
    effective.mode = "enforce";
  }
  effective.detectors = [...detectors];
  return effective;
}

export function companyRuntimeFailure(
  state: State,
  project: Row,
  estimate = 0,
) {
  if (state.settings.companyStatus && state.settings.companyStatus !== "Active")
    return "Complete company onboarding before running requests";
  const traces = state.data.traces.filter((t) => t.project === project.id);
  if (
    traces.filter(
      (t) => t.kind !== "external" && num(t.ts) > Date.now() - 60000,
    ).length >= num(state.settings.requestLimit, 120)
  )
    return "Company application request limit reached";
  const now = new Date(),
    month = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const spent = traces
    .filter((t) => num(t.ts) >= month)
    .reduce((total, t) => total + num(t.cost), 0);
  if (
    spent + estimate > num(state.settings.monthlyBudget, 100000) ||
    (estimate === 0 && spent >= num(state.settings.monthlyBudget, 100000))
  )
    return "Company monthly application budget reached";
  for (const [key, detector] of [
    ["mandatoryPii", "pii"],
    ["mandatoryInjection", "injection"],
  ])
    if (
      state.settings[key] &&
      !state.data.detectors.some(
        (d) => d.id === detector && d.status === "Active",
      )
    )
      return `Mandatory company detector ${detector} is unavailable`;
  return "";
}

export function companyModelAllowed(state: State, provider: string) {
  const allowedProviders = arr<string>(state.settings.allowedProviders),
    allowedModels = arr<string>(state.settings.allowedModels);
  if (allowedProviders.length && !allowedProviders.includes(provider))
    return false;
  const connection = state.data.providers.find((p) => p.id === provider);
  // Binding is to the model actually configured on the connection, not any approved sibling.
  return (
    !allowedModels.length ||
    state.data.models.some(
      (m) =>
        m.provider === provider &&
        m.status === "Approved" &&
        str(m.name) === str(connection?.model) &&
        allowedModels.includes(m.id),
    )
  );
}
