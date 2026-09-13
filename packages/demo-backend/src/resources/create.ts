import { Row, str, uid } from "@neurofence/contracts/types";
import { CollectionContext } from "../context";
import { configCollections } from "./schema";
import { validate } from "./validate";

export function createResource(ctx: CollectionContext) {
  const { collection } = ctx;
  const { session, body, state, audit, respond } = ctx;
  validate(collection, body, state, session);
  const record: Row = {
    ...body,
    id: uid(collection),
    version: 1,
    status: configCollections.includes(collection)
      ? "Draft"
      : collection === "exceptions"
        ? "Pending"
        : "Draft",
    createdAt: Date.now(),
    requestedBy: session.user,
  };
  if (collection === "projects")
    Object.assign(record, {
      status: "Active",
      keyStatus: "Not issued",
      keySuffix: "",
    });
  if (collection === "agents")
    Object.assign(record, {
      status: "Active",
      stepsUsed: 0,
      workflow: uid("workflow"),
      workflowStart: Date.now(),
    });
  if (collection === "assets")
    Object.assign(record, {
      status: "Discovered",
      bomVersion: 1,
      bomHistory: [],
    });
  if (
    collection === "campaigns" &&
    ["Daily", "Weekly"].includes(str(body.schedule))
  ) {
    record.scheduleEnabled = true;
    record.nextRunAt =
      Date.now() + (body.schedule === "Weekly" ? 7 : 1) * 86400000;
  }
  if (collection === "members") record.status = "Invited";
  if (collection === "workforcePolicies") record.status = "Active";
  if (collection === "workforce") {
    const policy = state.data.workforcePolicies.find(
      (p) =>
        p.instance === body.instance &&
        p.activity === body.activity &&
        p.status === "Active",
    );
    Object.assign(record, {
      ts: Date.now(),
      status:
        body.instance === "Enterprise tenant" ? "Sanctioned" : "Unsanctioned",
      action: policy?.action || "Coach",
      events: 1,
      reason: policy
        ? `Matched ${policy.name}`
        : "Unmanaged activity requires review",
    });
    if (record.action === "Block")
      state.data.incidents.unshift({
        id: uid("INC"),
        version: 1,
        title: `${record.app}: ${record.activity} blocked`,
        source: "Workforce AI",
        severity: "High",
        status: "Open",
        owner: "SOC team",
        ts: Date.now(),
        reason: record.reason,
        workforce: record.id,
        notes: [],
      });
  }
  if (configCollections.includes(collection)) {
    record.draft = { ...body };
    record.draftVersion = 1;
    record.draftStatus = "Draft";
    record.history = [];
  }
  state.data[collection].push(record);
  audit(`Created ${collection}`, str(record.name), record.id);
  if (collection === "exceptions")
    state.data.approvals.unshift({
      id: uid("approval"),
      version: 1,
      kind: "exception",
      name: str(record.name),
      resource: record.id,
      status: "Pending",
      requestedBy: session.user,
      expires: record.expires || Date.now() + 86400000,
      reason: record.reason || "",
      ts: Date.now(),
    });
  return respond(record);
}
