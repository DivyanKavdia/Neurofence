import { Row, Session, uid } from "@neurofence/contracts/types";

export function createTrace(kind: string, session: Session, project: Row): Row {
  return {
    id: uid("trace"),
    version: 1,
    ts: Date.now(),
    project: project.id,
    costCenter: project.costCenter || "Unallocated",
    budgetScope: project.budget || null,
    budgetAttribution: "request",
    principal: session.user,
    tenant: session.tenant,
    environment: session.environment,
    kind,
    workflow: uid("workflow"),
    decision: "ALLOW",
    reason: "",
    cost: 0,
    tokens: 0,
    executed: false,
    policyVersion: 0,
    preview: "",
    stages: [],
  };
}
