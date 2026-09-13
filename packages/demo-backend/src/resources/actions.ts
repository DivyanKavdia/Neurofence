import {
  ApiError,
  arr,
  Json,
  num,
  Row,
  str,
  uid,
} from "@neurofence/contracts/types";
import { CollectionContext } from "../context";
import { requireValue } from "../shared/values";
import { fields } from "./schema";
import { validate } from "./validate";

export function updateResource(ctx: CollectionContext, record: Row) {
  const { collection } = ctx;
  const {
    session,
    method,
    body,
    id,
    action,
    state,
    audit,
    respond,
    invalidate,
  } = ctx;
  if (
    collection === "providers" &&
    ["validate", "discover", "publish"].includes(action)
  ) {
    if (action === "validate") {
      requireValue(
        str(record.secret).startsWith("vault://") ||
          str(record.secret).startsWith("arn:"),
        "Use a Vault or AWS Secrets Manager reference.",
      );
      record.status = "Validated";
      record.validation = "Sample connection validation passed";
    }
    if (action === "discover") {
      requireValue(
        ["Validated", "Healthy"].includes(str(record.status)),
        "Validate this connection first.",
      );
      if (!state.data.models.some((m) => m.provider === id))
        state.data.models.push({
          id: uid("model"),
          version: 1,
          name: `${record.type} chat deployment`,
          provider: id,
          region: record.region,
          status: "Discovered",
          capabilities: ["Chat", "Streaming"],
          inputRate: 0.35,
          outputRate: 0.9,
        });
      record.discovery = "Completed";
    }
    if (action === "publish") {
      requireValue(
        state.data.models.some(
          (m) => m.provider === id && m.status === "Approved",
        ),
        "Approve at least one discovered model first.",
      );
      record.status = "Healthy";
      record.model =
        state.data.models.find(
          (m) => m.provider === id && m.status === "Approved",
        )?.name || "";
    }
  } else if (collection === "models" && action === "approve") {
    record.status = "Approved";
  } else if (
    collection === "projects" &&
    ["issue", "rotate", "revoke"].includes(action)
  ) {
    record.keyStatus = action === "revoke" ? "Revoked" : "Active";
    record.version++;
    invalidate("Application credential changed");
    audit(`Credential ${action}`, str(record.name), id);
    const credential = action === "revoke" ? null : `nf_demo_${uid("key")}`;
    record.keySuffix = credential?.slice(-4) || "";
    return respond({
      record,
      credential,
      baseURL: "https://gateway.example.test/v1",
    });
  } else if (collection === "agents" && action === "workflow") {
    record.workflow = uid("workflow");
    record.stepsUsed = 0;
    record.workflowStart = Date.now();
    invalidate("A new agent workflow started");
  } else if (collection === "servers" && action === "discover") {
    record.status = "Discovered";
    record.resources = ["Approved records"];
    record.prompts = ["Summarise"];
    record.provenance = "Sample package verified";
    if (!state.data.tools.some((t) => t.serverId === id))
      state.data.tools.push({
        id: uid("tool"),
        version: 1,
        name: `${str(record.name).toLowerCase().replace(/\W/g, "")}.read`,
        serverId: id,
        server: record.name,
        action: "READ",
        scope: "RECORD-*",
        parameters: ["record_id"],
        status: "Pending",
        risk: "Medium",
        expires: Date.now() + 86400000,
      });
  } else if (collection === "tools" && action === "approve") {
    requireValue(
      num(record.expires) > Date.now(),
      "Set a future permission expiry.",
    );
    record.status = ["DELETE", "PRIVILEGED"].includes(str(record.action))
      ? "Blocked"
      : record.action === "READ"
        ? "Approved"
        : "Approval required";
    invalidate("Tool permissions changed");
  } else if (collection === "assets" && action === "snapshot") {
    record.bomHistory = [
      ...arr(record.bomHistory),
      {
        version: record.bomVersion || 1,
        links: record.links || [],
        owner: record.owner || "",
        tags: record.tags || [],
        ts: Date.now(),
      },
    ];
    record.bomVersion = num(record.bomVersion, 1) + 1;
  } else if (
    ["campaigns", "scans"].includes(collection) &&
    ["run", "retest"].includes(action)
  ) {
    requireValue(record.status !== "Running", "This job is already running.");
    record.status = "Running";
    record.jobId = uid("job");
    state.data.jobs.push({
      id: str(record.jobId),
      version: 1,
      collection,
      resource: id,
      status: "Running",
      progress: 0,
      startedAt: Date.now(),
      readyAt: Date.now() + 900,
    });
  } else if (
    ["campaigns", "scans"].includes(collection) &&
    action === "remediate"
  ) {
    requireValue(
      str(body.reason).trim().length >= 5,
      "Link a remediation note or change reference.",
    );
    record.remediation = body.reason;
    record.status = "Ready for retest";
  } else if (["campaigns", "scans"].includes(collection) && action === "gate") {
    requireValue(
      record.status === "Passed",
      "A passing retest is required to release.",
    );
    record.gate = "Released";
  } else if (collection === "integrations" && action === "test") {
    record.status = str(record.endpoint).includes("fail")
      ? "Failed"
      : "Connected";
    record.lastTest = Date.now();
    record.message =
      record.status === "Failed"
        ? "Simulated endpoint failure"
        : "Sample delivery acknowledged";
  } else if (action === "status") {
    requireValue(
      [
        "Active",
        "Paused",
        "Suspended",
        "Blocked",
        "Healthy",
        "Quarantined",
        "Archived",
      ].includes(str(body.status)),
      "Unsupported status.",
    );
    if (collection === "providers" && body.status === "Healthy")
      requireValue(
        state.data.models.some(
          (m) => m.provider === id && m.status === "Approved",
        ) && record.validation,
        "Validate the provider and approve its model catalog before resuming.",
      );
    record.status = body.status;
    if (["projects", "agents", "tools"].includes(collection))
      invalidate("Access changed");
  } else if (method === "PATCH") {
    const next = {
      ...Object.fromEntries(
        (fields[collection] || [])
          .map((k) => [k, record[k]])
          .filter(([, v]) => v !== undefined),
      ),
      ...body,
    } as Record<string, Json>;
    validate(collection, next, state, session, id);
    Object.assign(record, body);
    if (["agents", "projects", "tools"].includes(collection))
      invalidate("Access bindings changed");
  } else
    throw new ApiError(404, "UNKNOWN_ACTION", "This action is not supported.");
  record.version++;
  audit(`${collection} ${action || "updated"}`, str(record.name), id);
  return respond(record);
}
