import { ProviderConnector } from "@neurofence/contracts/provider";
import {
  ApiError,
  can,
  Collection,
  collections,
  Request,
  Result,
  Row,
  Session,
  str,
  uid,
} from "@neurofence/contracts/types";
import { createState } from "./fixtures/seed";
import { ownRoles } from "./resources/schema";
import { canonical, mask, requireValue } from "./shared/values";
import { Store } from "./stores/store";

export interface BackendServices {
  store: Store;
  receipts: Map<string, { payload: string; result: Result }>;
  providerConnector?: ProviderConnector;
}
export function createRequestContext(
  request: Request,
  session: Session,
  services: BackendServices,
) {
  const { providerConnector } = services;
  const method = request.method || "GET",
    body = request.body || {},
    url = new URL(request.path, "http://mock.local");
  requireValue(
    url.pathname.startsWith("/api/v1/"),
    "Use a versioned control API path.",
  );
  const [resource, id, action] = url.pathname
    .replace("/api/v1/", "")
    .split("/");
  const key = `${session.tenant}:${session.environment}`;
  const state = structuredClone(
    services.store.read(key) || createState(undefined, session.tenant),
  );
  // Additive migration preserves existing schema-2 browser/file workspaces.
  for (const collection of collections) state.data[collection] ||= [];
  const correlationId = uid("request");
  const persist = () => {
    const saved = structuredClone(state);
    if (!saved.settings.rawContent) {
      for (const trace of saved.data.traces) {
        if (trace.legalHold && trace.content) continue;
        if (!trace.modelRuntime || trace.modelRuntime === "mock") continue;
        delete trace.content;
        trace.preview = "Request content not retained";
        trace.output = "Response content not retained";
        trace.contentRetained = false;
      }
    }
    services.store.write(key, saved);
  };
  const permission = (cap: string) => {
    if (!can(session, cap))
      throw new ApiError(
        403,
        "FORBIDDEN",
        `${session.role} cannot perform this action.`,
        false,
        correlationId,
      );
  };
  const audit = (event: string, detail: string, reference = "") =>
    state.data.audit.unshift({
      id: uid("event"),
      version: 1,
      ts: Date.now(),
      actor: `${session.user} · ${session.role}`,
      event,
      detail: mask(detail),
      reference,
      tenant: session.tenant,
      environment: session.environment,
    });
  const done = (value: unknown, write = method !== "GET"): Result => {
    if (write) {
      state.revision++;
      persist();
    }
    return {
      data: structuredClone(value),
      meta: { correlationId, revision: state.revision },
    };
  };
  const inScope = (row: Row, collection: string) => {
    if (!ownRoles.includes(session.role)) return true;
    if (collection === "projects" || collection === "agents")
      return row.owner === session.user;
    if (
      ["traces", "approvals", "incidents", "campaigns", "scans"].includes(
        collection,
      )
    ) {
      const project = state.data.projects.find(
        (p) => p.id === (row.project || row.target),
      );
      const agent = state.data.agents.find((a) => a.id === row.agent);
      return (
        project?.owner === session.user ||
        agent?.owner === session.user ||
        row.requestedBy === session.user
      );
    }
    if (collection === "assets") return row.owner === session.user;
    if (
      ["workforce", "members", "controls", "distributions"].includes(collection)
    )
      return false;
    if (collection === "audit") return str(row.actor).startsWith(session.user);
    return true;
  };
  const find = (collection: Collection, rid: string) => {
    const row = state.data[collection].find((r) => r.id === rid);
    if (!row || !inScope(row, collection))
      throw new ApiError(
        404,
        "NOT_FOUND",
        "This record is unavailable in your current scope.",
      );
    return row;
  };
  const checkVersion = (row: Row) => {
    if (request.version === undefined)
      throw new ApiError(
        428,
        "VERSION_REQUIRED",
        "Reload the record before changing it.",
      );
    if (request.version !== row.version)
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "This record changed. Refresh it and review your changes before retrying.",
      );
  };
  const invalidate = (reason: string) => {
    for (const a of state.data.approvals)
      if (
        ["Pending", "Approved"].includes(str(a.status)) &&
        ["tool", "budget"].includes(str(a.kind))
      ) {
        a.status = "Cancelled";
        a.reason = reason;
        a.version++;
      }
  };
  const receiptKey = `${key}:${session.role}:${session.user}:${request.idempotencyKey}`;
  const payload = canonical({
    method,
    path: request.path,
    body,
    version: request.version ?? null,
  });
  const respond = (value: unknown, write = method !== "GET") => {
    const result = done(value, write);
    if (method !== "GET")
      services.receipts.set(receiptKey, { payload, result });
    return result;
  };
  return {
    request,
    session,
    services,
    providerConnector,
    method,
    body,
    url,
    resource,
    id,
    action,
    key,
    state,
    correlationId,
    persist,
    permission,
    audit,
    respond,
    inScope,
    find,
    checkVersion,
    invalidate,
    receiptKey,
    payload,
  };
}
export type RequestContext = ReturnType<typeof createRequestContext>;
export type CollectionContext = RequestContext & { collection: Collection };
export function replayReceipt(ctx: RequestContext): Result | undefined {
  const { request, services, method, receiptKey, payload } = ctx;
  if (method !== "GET") {
    requireValue(
      request.idempotencyKey,
      "Mutation requires an idempotency key.",
    );
    const previous = services.receipts.get(receiptKey);
    if (previous) {
      if (previous.payload !== payload)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This request key was used with different values.",
        );
      return structuredClone(previous.result);
    }
  }
}
