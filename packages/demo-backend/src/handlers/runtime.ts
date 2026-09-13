import {
  ApiError,
  arr,
  can,
  obj,
  Row,
  str,
  uid,
} from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { inspect, InspectionStage } from "../execution/inspect";
import { runModel } from "../execution/model";
import { runTool } from "../execution/tool";
import { hash, requireValue } from "../shared/values";

export async function handleRuntime(ctx: RequestContext) {
  const {
    session,
    providerConnector,
    method,
    body,
    resource,
    id,
    state,
    persist,
    permission,
    audit,
    respond,
    find,
    receiptKey,
    payload,
  } = ctx;
  if (resource === "runtime" && method === "POST") {
    permission("run");
    requireValue(
      ["model", "tool"].includes(id),
      "Choose the model or tool runtime.",
    );
    requireValue(
      arr(state.settings.modules).includes(id === "tool" ? "M5" : "M4"),
      "The runtime module is not enabled.",
    );
    const external = id === "model" && !!providerConnector;
    const durableKey = external ? await hash(receiptKey) : "";
    const payloadHash = external ? await hash(payload) : "";
    const previous = state.gatewayReceipts?.[durableKey];
    if (external && previous) {
      if (previous.payloadHash !== payloadHash)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This execution key was used with different values.",
        );
      if (previous.status === "pending")
        throw new ApiError(
          409,
          "OUTCOME_UNKNOWN",
          "This execution was interrupted. Its reservation is held; reconcile the existing trace before starting another request.",
          false,
          previous.trace,
        );
      return respond(find("traces", previous.trace), false);
    }
    const checkpoint = external
      ? (trace: Row) => {
          state.gatewayReceipts ||= {};
          state.gatewayReceipts[durableKey] = {
            payloadHash,
            trace: trace.id,
            status: "pending",
          };
          state.data.traces.unshift(trace);
          state.revision++;
          persist();
        }
      : undefined;
    const trace =
      id === "tool"
        ? runTool(state, session, body, find, audit)
        : await runModel(
            providerConnector,
            state,
            session,
            body,
            find,
            audit,
            checkpoint,
          );
    if (!state.data.traces.some((t) => t.id === trace.id))
      state.data.traces.unshift(trace);
    if (external) {
      state.gatewayReceipts ||= {};
      state.gatewayReceipts[durableKey] = {
        payloadHash,
        trace: trace.id,
        status: "complete",
      };
    }
    audit(
      `${id === "tool" ? "Tool" : "Model"} request · ${trace.decision}`,
      str(trace.reason),
      trace.id,
    );
    if (trace.decision === "DENY")
      state.data.incidents.unshift({
        id: uid("INC"),
        version: 1,
        title: str(trace.reason),
        source: id === "tool" ? "Agent & MCP" : "AI Gateway",
        severity: id === "tool" ? "High" : "Medium",
        project: trace.project || "",
        agent: trace.agent || null,
        trace: trace.id,
        status: "Open",
        owner: "Security team",
        ts: Date.now(),
        reason: trace.reason || "",
        notes: [],
      });
    return respond(trace);
  }
  if (resource === "inspect" && method === "POST") {
    requireValue(
      can(session, "run") || can(session, "policies"),
      "Your role cannot run simulations.",
    );
    const policy = find("policies", str(body.policy || "baseline"));
    const effective = { ...policy, ...(body.draft ? obj(policy.draft) : {}) };
    if (body.stage === "Response" || body.stage === "Tool result")
      effective.pii = effective.responseAction || effective.pii;
    requireValue(
      ["Request", "Response", "Tool arguments", "Tool result"].includes(
        str(body.stage || "Request"),
      ),
      "Choose an inspection stage.",
    );
    requireValue(
      str(body.text).length <= 200000,
      "Inspection input exceeds 200,000 characters.",
    );
    return respond(
      inspect(
        str(body.text),
        effective,
        state,
        str(body.stage || "Request") as InspectionStage,
      ),
    );
  }
}
