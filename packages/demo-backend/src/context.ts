import { ProviderConnector } from "@neurofence/contracts/provider";
import { resolveCompanyConfig } from "@neurofence/contracts/company";
import {
  authorizeCompany,
  loadDirectory,
  resolveMembership,
} from "./company/directory";
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
  receipts: Map<
    string,
    { payload: string; result: Result; permissions: string[] }
  >;
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
  const directory = loadDirectory(services.store);
  const company = directory.companies.find((c) => c.id === session.tenant);
  if (!company)
    throw new ApiError(
      404,
      "COMPANY_NOT_FOUND",
      "This company is not registered. An operator must onboard it first.",
    );
  session = authorizeCompany(company, session);
  if (
    session.role === "Neurofence operator" &&
    !["companies", "workspace", "session", "capabilities", "company"].includes(
      resource,
    )
  )
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Operator access is limited to company provisioning. Select a company membership to access product data.",
    );
  const key = `${session.tenant}:${session.environment}`;
  const state = structuredClone(
    services.store.read(key) || createState(undefined, session.tenant),
  );
  // Additive migration preserves existing schema-2 browser/file workspaces.
  for (const collection of collections) state.data[collection] ||= [];
  const effective = resolveCompanyConfig(company, session.environment);
  Object.assign(state.settings, effective.values);
  state.settings.companyConfigVersion = company.publishedVersion;
  state.data.members = structuredClone(company.members).map((m) => ({
    ...m,
    role: m.roles.join(", "),
  }));
  // Membership and configuration live in the company directory, never in an API snapshot.
  delete state.company;
  const correlationId = uid("request");
  const requiredPermissions = new Set<string>();
  const persist = () => {
    const saved = structuredClone(state);
    delete saved.company;
    {
      for (const trace of saved.data.traces) {
        if (
          resolveCompanyConfig(company, session.environment, str(trace.project))
            .values.rawContent
        )
          continue;
        if (trace.legalHold && trace.content) continue;
        delete trace.content;
        if (trace.modelRuntime && trace.modelRuntime !== "mock") {
          trace.preview = "Request content not retained";
          trace.output = "Response content not retained";
        }
        trace.contentRetained = false;
      }
    }
    services.store.write(key, saved);
  };
  const permission = (cap: string) => {
    requiredPermissions.add(cap);
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
    if (session.role === "Neurofence operator") return false;
    if (!ownRoles.includes(session.role)) return true;
    const member = resolveMembership(company, session);
    const teamProject = (project: string) =>
      company.projectTeams.some(
        (p) =>
          p.environment === session.environment &&
          p.project === project &&
          member.teams.includes(p.team),
      );
    if (collection === "projects" || collection === "agents")
      return (
        row.owner === session.user ||
        teamProject(collection === "projects" ? row.id : str(row.project))
      );
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
        teamProject(str(project?.id)) ||
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
      services.receipts.set(receiptKey, {
        payload,
        result,
        permissions: [...requiredPermissions],
      });
    return result;
  };
  return {
    request,
    session,
    services,
    directory,
    company,
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
      for (const capability of previous.permissions) ctx.permission(capability);
      return structuredClone(previous.result);
    }
  }
}
