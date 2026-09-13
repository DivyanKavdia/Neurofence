import {
  ApiError,
  arr,
  can,
  Collection,
  collections,
  initialSession,
  Json,
  num,
  obj,
  Request,
  Result,
  Role,
  roles,
  round,
  Row,
  Session,
  State,
  str,
  Transport,
  uid,
} from "./types";
import { createState } from "./seed";
import { budgetSpend, periodStart } from "./ledger";

export interface Store {
  read(key: string): State | undefined;
  write(key: string, state: State): void;
}
export class MemoryStore implements Store {
  values = new Map<string, State>();
  read(key: string) {
    return this.values.get(key);
  }
  write(key: string, state: State) {
    this.values.set(key, structuredClone(state));
  }
}
export class BrowserStore implements Store {
  read(key: string) {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`neuralfence.console.v2.${key}`) || "null",
      );
      if (saved?.schema === 2) return saved as State;
      if (key === "acme:Development") {
        const old = JSON.parse(
          localStorage.getItem("neuralfence.prototype.v1") || "null",
        );
        if (old?.schema === 1 && Array.isArray(old.projects))
          return createState(old);
      }
    } catch {
      /* A damaged or unavailable browser store must not prevent the demo opening. */
    }
    return undefined;
  }
  write(key: string, state: State) {
    try {
      localStorage.setItem(
        `neuralfence.console.v2.${key}`,
        JSON.stringify(state),
      );
    } catch {
      throw new ApiError(
        507,
        "STORAGE_FULL",
        "Browser storage is unavailable. Export your work, free storage and retry.",
      );
    }
  }
}
const fields: Partial<Record<Collection, string[]>> = {
  workforce: [
    "name",
    "app",
    "user",
    "instance",
    "activity",
    "classification",
    "device",
  ],
  providers: ["name", "type", "region", "secret", "endpoint"],
  models: [
    "name",
    "provider",
    "region",
    "capabilities",
    "inputRate",
    "outputRate",
  ],
  projects: ["name", "owner", "route", "budget", "policy"],
  routes: [
    "name",
    "alias",
    "primary",
    "fallback",
    "threshold",
    "retries",
    "region",
  ],
  policies: [
    "name",
    "pii",
    "injection",
    "region",
    "response",
    "responseAction",
    "streaming",
    "maxTokens",
    "detectors",
    "mode",
  ],
  budgets: [
    "name",
    "parent",
    "limit",
    "hard",
    "currency",
    "period",
    "threshold",
    "action",
    "fallback",
    "rpm",
    "tokens",
    "concurrency",
  ],
  agents: [
    "name",
    "owner",
    "purpose",
    "project",
    "allowedTools",
    "dataScope",
    "environment",
    "maxSteps",
    "maxDuration",
    "maxDepth",
  ],
  servers: ["name", "endpoint", "transport", "auth", "secret", "owner"],
  tools: ["name", "serverId", "action", "scope", "parameters", "expires"],
  assets: [
    "name",
    "type",
    "owner",
    "risk",
    "coverage",
    "tags",
    "links",
    "status",
  ],
  workforcePolicies: [
    "name",
    "instance",
    "activity",
    "action",
    "justification",
  ],
  exceptions: ["name", "resource", "reason", "expires", "scope"],
  campaigns: ["name", "target", "pack", "schedule", "gate"],
  scans: ["name", "target", "artifact", "provenance", "gate"],
  integrations: ["name", "type", "endpoint", "secret"],
  members: ["name", "email", "role"],
  savedViews: [
    "name",
    "page",
    "query",
    "filter",
    "columns",
    "sort",
    "direction",
  ],
};
const configCollections: Collection[] = ["policies", "routes", "budgets"];
const moduleFor: Partial<Record<Collection, string>> = {
  providers: "M4",
  models: "M4",
  projects: "M4",
  routes: "M4",
  policies: "M3",
  budgets: "M6",
  agents: "M5",
  servers: "M5",
  tools: "M5",
  assets: "M1",
  workforce: "M2",
  workforcePolicies: "M2",
  campaigns: "M7",
  scans: "M8",
  detectors: "M3",
};
const ownRoles: Role[] = ["Developer", "Agent owner"];
const canonical = (value: Json): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value !== null && typeof value === "object"
      ? `{${Object.keys(value)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
          .join(",")}}`
      : JSON.stringify(value);
const mask = (text: string) =>
  text
    .replace(/\b\d{12,16}\b/g, "[IDENTIFIER]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\b(?:sk-|api_key[=: ]+)[A-Za-z0-9_-]{8,}\b/gi, "[SECRET]");
function requireValue(ok: unknown, message: string, code = "VALIDATION") {
  if (!ok) throw new ApiError(422, code, message);
}

/** Stateful BFF simulator, used unchanged by the browser and optional HTTP server.
 * It never contacts a provider, sends invitations, scans a package or provisions cloud resources.
 */
export class MockBackend implements Transport {
  session = { ...initialSession };
  private queue = Promise.resolve();
  private receipts = new Map<string, { payload: string; result: Result }>();
  constructor(
    private store: Store = new MemoryStore(),
    private latency = 80,
  ) {}
  setSession(session: Session) {
    this.session = { ...session };
  }
  async request<T>(request: Request): Promise<Result<T>> {
    const session = { ...this.session };
    if (this.latency)
      await new Promise((resolve) => setTimeout(resolve, this.latency));
    const work = this.queue.then(() => this.dispatch(request, session));
    this.queue = work.then(
      () => undefined,
      () => undefined,
    );
    return (await work) as Result<T>;
  }
  private dispatch(request: Request, session: Session): Result {
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
      this.store.read(key) || createState(undefined, session.tenant),
    );
    const correlationId = uid("request");
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
        this.store.write(key, state);
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
      if (["workforce", "members"].includes(collection)) return false;
      if (collection === "audit")
        return str(row.actor).startsWith(session.user);
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
    if (method !== "GET") {
      requireValue(
        request.idempotencyKey,
        "Mutation requires an idempotency key.",
      );
      const previous = this.receipts.get(receiptKey);
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
    const respond = (value: unknown, write = method !== "GET") => {
      const result = done(value, write);
      if (method !== "GET") this.receipts.set(receiptKey, { payload, result });
      return result;
    };
    this.completeJobs(state, audit);
    if (resource === "workspace" && method === "GET") {
      const scoped = structuredClone(state);
      for (const c of collections) {
        scoped.data[c] = scoped.data[c].filter((r) => inScope(r, c));
        if (
          moduleFor[c] &&
          !arr(state.settings.modules).includes(moduleFor[c]!)
        )
          scoped.data[c] = [];
      }
      for (const t of scoped.data.traces) {
        delete t.content;
        t.preview = mask(str(t.preview));
        t.output = mask(str(t.output));
      }
      for (const a of scoped.data.approvals) {
        delete a.fingerprint;
        if (["FinOps owner", "Auditor"].includes(session.role)) delete a.args;
      }
      if (ownRoles.includes(session.role)) {
        scoped.data.audit = scoped.data.audit.filter((e) =>
          str(e.actor).startsWith(session.user),
        );
        scoped.data.members = [];
        scoped.data.workforce = [];
      }
      return respond(scoped, true);
    }
    if (resource === "capabilities")
      return respond({
        role: session.role,
        modules: state.settings.modules,
        environment: session.environment,
      });
    if (resource === "health")
      return respond({
        status: "Healthy",
        mode: "mock",
        dependencies: "Simulated",
        controlPlane: state.settings.controlPlane,
      });
    if (resource === "session") return respond(session);
    if (resource === "reset" && method === "POST") {
      permission("settings");
      this.store.write(key, createState(undefined, session.tenant));
      this.receipts.clear();
      return { data: { reset: true }, meta: { correlationId, revision: 1 } };
    }
    if (resource === "settings" && method === "PATCH") {
      permission("settings");
      checkVersion(state.settings);
      const allowed = [
        "name",
        "retention",
        "days",
        "deployment",
        "residency",
        "fourEyes",
        "rawContent",
        "modules",
        "density",
        "controlPlane",
      ];
      requireValue(
        Object.keys(body).every((k) => allowed.includes(k)),
        "Unknown setting.",
      );
      if (body.days !== undefined)
        requireValue(
          num(body.days) >= 1 && num(body.days) <= 3650,
          "Retention must be between 1 and 3650 days.",
        );
      if (body.modules)
        requireValue(
          arr(body.modules).includes("M9"),
          "Governance is required for workspace administration.",
        );
      if (body.retention === "Metadata only") body.rawContent = false;
      if (body.rawContent === false)
        for (const trace of state.data.traces) delete trace.content;
      Object.assign(state.settings, body, {
        version: state.settings.version + 1,
      });
      audit(
        "Updated workspace settings",
        str(body.name || state.settings.name),
      );
      return respond(state.settings);
    }
    if (resource === "runtime" && method === "POST") {
      permission("run");
      requireValue(
        arr(state.settings.modules).includes(id === "tool" ? "M5" : "M4"),
        "The runtime module is not enabled.",
      );
      const trace =
        id === "tool"
          ? this.runTool(state, session, body, find, audit)
          : this.runModel(state, session, body, find, audit);
      state.data.traces.unshift(trace);
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
      if (body.stage === "Response")
        effective.pii = effective.responseAction || effective.pii;
      return respond(this.inspect(str(body.text), effective, state));
    }
    if (!collections.includes(resource as Collection))
      throw new ApiError(
        404,
        "UNKNOWN_ENDPOINT",
        "This API endpoint is unavailable.",
      );
    const collection = resource as Collection;
    if (
      moduleFor[collection] &&
      !arr(state.settings.modules).includes(moduleFor[collection]!)
    )
      throw new ApiError(
        403,
        "MODULE_DISABLED",
        "This module is not enabled in the workspace.",
      );
    if (method === "GET") {
      if (id) {
        const r = structuredClone(find(collection, id));
        delete r.content;
        delete r.fingerprint;
        if (
          collection === "approvals" &&
          ["FinOps owner", "Auditor"].includes(session.role)
        )
          delete r.args;
        return respond(r, true);
      }
      let rows = state.data[collection].filter((r) => inScope(r, collection));
      const query = url.searchParams.get("q")?.toLowerCase(),
        status = url.searchParams.get("status");
      if (query)
        rows = rows.filter((r) =>
          JSON.stringify(r).toLowerCase().includes(query),
        );
      if (status && status !== "All")
        rows = rows.filter((r) => r.status === status || r.decision === status);
      const sort = url.searchParams.get("sort") || "ts";
      rows = [...rows].sort((a, b) =>
        str(b[sort]).localeCompare(str(a[sort]), undefined, { numeric: true }),
      );
      const offset = Math.max(0, num(url.searchParams.get("cursor"))),
        limit = Math.min(
          100,
          Math.max(1, num(url.searchParams.get("limit") ?? 25, 25)),
        );
      const result = respond(
        rows.slice(offset, offset + limit).map((r) => {
          const clean = { ...r };
          delete clean.content;
          delete clean.fingerprint;
          if (
            collection === "approvals" &&
            ["FinOps owner", "Auditor"].includes(session.role)
          )
            delete clean.args;
          return clean;
        }),
        true,
      );
      if (offset + limit < rows.length)
        result.meta.nextCursor = String(offset + limit);
      return result;
    }
    if (collection === "traces" && id) {
      const trace = find("traces", id);
      if (action === "reveal") {
        permission("reveal");
        requireValue(
          state.settings.rawContent && trace.content,
          "Raw content was not retained for this trace. Enable explicit content retention for future demo requests.",
        );
        audit(
          "Revealed retained content",
          "Content access explicitly requested",
          id,
        );
        return respond({ content: trace.content });
      }
      if (action === "replay") {
        permission("run");
        requireValue(
          session.environment !== "Production",
          "Replay is available only outside production.",
        );
        return respond({
          project: trace.project,
          prompt: trace.preview,
          agent: trace.agent,
          tool: trace.target,
          kind: trace.kind,
        });
      }
      if (action === "export") {
        audit("Exported trace evidence", "Metadata evidence export", id);
        const copy = { ...trace };
        delete copy.content;
        return respond({
          prototype: true,
          trace: copy,
          events: state.data.audit.filter((a) => a.reference === id),
        });
      }
    }
    if (collection === "approvals") {
      const approval = find(collection, id);
      if (approval.kind === "config" && approval.collection === "routes")
        permission("routes");
      else if (
        approval.kind === "budget" ||
        (approval.kind === "config" && approval.collection === "budgets")
      )
        permission("budgets");
      else permission("approval");
      checkVersion(approval);
      requireValue(
        approval.status === "Pending" && num(approval.expires) > Date.now(),
        "This approval is no longer pending.",
      );
      requireValue(
        !state.settings.fourEyes || approval.requestedBy !== session.user,
        "A different person must review this request.",
      );
      requireValue(
        str(body.reason).trim().length >= 5,
        "Give a review reason of at least five characters.",
      );
      requireValue(
        ["Approved", "Denied"].includes(str(body.decision)),
        "Choose approve or deny.",
      );
      approval.status = body.decision;
      approval.reason = body.reason;
      approval.decidedBy = session.user;
      approval.version++;
      approval.decidedAt = Date.now();
      if (approval.kind === "config") {
        const target = find(
          str(approval.collection) as Collection,
          str(approval.resource),
        );
        requireValue(
          target.draftVersion === approval.draftVersion,
          "The draft changed after approval was requested.",
        );
        target.draftStatus = approval.status;
        target.version++;
      }
      if (approval.kind === "exception") {
        const target = find("exceptions", str(approval.resource));
        target.status = approval.status;
        target.version++;
      }
      audit(
        `Approval ${str(body.decision).toLowerCase()}`,
        str(body.reason),
        approval.id,
      );
      return respond(approval);
    }
    if (collection === "incidents") {
      const incident = find(collection, id);
      if (action === "export") {
        audit("Exported incident evidence", str(incident.title), id);
        const trace = state.data.traces.find((t) => t.id === incident.trace);
        const redacted = trace ? { ...trace } : null;
        if (redacted) delete redacted.content;
        return respond({
          prototype: true,
          incident,
          trace: redacted,
          events: state.data.audit.filter(
            (e) => e.reference === id || e.reference === incident.trace,
          ),
        });
      }
      permission("incidents");
      checkVersion(incident);
      requireValue(
        str(body.reason).trim().length >= 5,
        "Record a reason or investigation note.",
      );
      if (action === "contain") {
        const agent = state.data.agents.find((a) => a.id === incident.agent);
        requireValue(agent, "This incident has no associated agent.");
        agent!.status = "Suspended";
        agent!.version++;
        invalidate("Agent contained");
      }
      if (action === "revoke") {
        const trace = state.data.traces.find((t) => t.id === incident.trace);
        const project = state.data.projects.find(
          (p) => p.id === (incident.project || trace?.project),
        );
        requireValue(project, "This incident has no associated application.");
        project!.keyStatus = "Revoked";
        project!.version++;
        invalidate("Application credential revoked");
      }
      if (action === "resolve") incident.status = "Resolved";
      else if (action === "reopen") incident.status = "Open";
      if (body.owner) incident.owner = body.owner;
      incident.notes = [
        ...arr(incident.notes),
        {
          text: str(body.reason),
          actor: session.user,
          ts: Date.now(),
          action: action || "review",
        },
      ];
      incident.version++;
      audit(`Incident ${action || "review"}`, str(body.reason), id);
      return respond(incident);
    }
    if (collection === "audit" && action === "export")
      return respond({ prototype: true, events: state.data.audit });
    if (collection === "detectors") {
      permission("detectors");
      const detector = find(collection, id);
      checkVersion(detector);
      requireValue(
        !detector.critical || body.status !== "Disabled",
        "Critical baseline detectors cannot be disabled.",
      );
      detector.status = body.status || "Active";
      detector.version++;
      audit("Updated detector", str(detector.name), id);
      return respond(detector);
    }
    if (collection === "workforce" && id) {
      permission("workforce");
      const event = find(collection, id);
      checkVersion(event);
      requireValue(
        ["Allow", "Coach", "Redact", "Block"].includes(str(body.action)),
        "Choose an activity outcome.",
      );
      requireValue(
        str(body.reason).trim().length >= 5,
        "Give a reason for this control.",
      );
      event.action = body.action;
      event.reason = body.reason;
      event.version++;
      audit("Updated workforce control", str(body.reason), id);
      return respond(event);
    }
    permission(collection);
    if (method === "DELETE") {
      const record = find(collection, id);
      checkVersion(record);
      requireValue(
        str(body.reason).trim().length >= 5,
        "Give a reason before removing a record.",
      );
      requireValue(
        ["members", "integrations", "savedViews"].includes(collection),
        "Archive or revoke this resource instead of deleting its history.",
      );
      requireValue(
        !(
          collection === "members" &&
          record.role === "Platform admin" &&
          state.data.members.filter(
            (m) => m.role === "Platform admin" && m.status === "Active",
          ).length <= 1
        ),
        "Keep at least one active platform administrator.",
      );
      state.data[collection] = state.data[collection].filter(
        (r) => r.id !== id,
      );
      audit(`Removed ${collection}`, str(record.name), id);
      return respond({ deleted: id });
    }
    if (!id) {
      this.validate(collection, body, state, session);
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
            body.instance === "Enterprise tenant"
              ? "Sanctioned"
              : "Unsanctioned",
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
    const record = find(collection, id);
    checkVersion(record);
    if (configCollections.includes(collection) && action) {
      if (action === "draft") {
        this.validate(collection, body, state, session, id);
        record.draft = { ...body };
        record.draftVersion = num(record.publishedVersion, record.version) + 1;
        record.draftStatus = "Draft";
        record.draftBy = session.user;
        record.simulation = null;
        for (const a of state.data.approvals)
          if (
            a.resource === id &&
            a.kind === "config" &&
            ["Pending", "Approved"].includes(str(a.status))
          ) {
            a.status = "Cancelled";
            a.version++;
          }
      } else if (action === "simulate") {
        requireValue(record.draft, "Save a draft before simulating.");
        record.draftStatus = "Simulated";
        record.simulation = {
          ts: Date.now(),
          status: "Passed",
          affected: state.data.projects.filter(
            (p) => p.policy === id || p.route === id || p.budget === id,
          ).length,
          checks: ["Schema valid", "References resolve", "Limits valid"],
        };
      } else if (action === "submit") {
        requireValue(
          record.draftStatus === "Simulated",
          "Simulate the current draft before review.",
        );
        record.draftStatus = "Pending";
        state.data.approvals.unshift({
          id: uid("approval"),
          version: 1,
          kind: "config",
          name: `${record.name} v${record.draftVersion}`,
          resource: id,
          collection,
          draftVersion: record.draftVersion,
          status: "Pending",
          requestedBy: session.user,
          expires: Date.now() + 86400000,
          ts: Date.now(),
        });
      } else if (action === "publish" || action === "canary") {
        requireValue(
          record.draftStatus === "Approved",
          "An approved draft is required before publishing.",
        );
        if (action === "canary")
          requireValue(
            num(record.publishedVersion) > 0,
            "Publish an initial version before starting a canary.",
          );
        const snapshot = { ...record };
        delete snapshot.history;
        delete snapshot.draft;
        delete snapshot.simulation;
        record.history = [...arr(record.history), snapshot as Json];
        Object.assign(record, obj(record.draft));
        record.status = action === "canary" ? "Canary" : "Active";
        record.canary = action === "canary" ? 10 : 100;
        record.publishedVersion = record.draftVersion;
        record.draft = null;
        record.draftStatus = "";
        record.publishedBy = session.user;
        invalidate("Published configuration changed");
      } else if (action === "promote") {
        requireValue(record.status === "Canary", "Publish a canary first.");
        record.status = "Active";
        record.canary = 100;
      } else if (action === "rollback") {
        requireValue(
          str(body.reason).trim().length >= 5,
          "Record a rollback reason.",
        );
        record.rollbackReason = body.reason;
        const history = arr<Record<string, Json>>(record.history);
        requireValue(
          history.length,
          "There is no earlier published configuration.",
        );
        const previous = history.at(-1)!;
        const snapshot = { ...record };
        delete snapshot.history;
        delete snapshot.draft;
        for (const field of fields[collection] || [])
          if (previous[field] !== undefined) record[field] = previous[field];
        record.history = [...history, snapshot as Json];
        record.publishedVersion =
          num(record.publishedVersion, record.version) + 1;
        record.status = "Active";
        record.draft = null;
        record.draftStatus = "";
        record.canary = 100;
        invalidate("Configuration rolled back");
      } else
        throw new ApiError(
          404,
          "UNKNOWN_ACTION",
          "Unknown configuration action.",
        );
      record.version++;
      audit(
        `${collection} ${action}`,
        `${record.name} · version ${record.publishedVersion || record.draftVersion}`,
        id,
      );
      return respond(record);
    }
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
    } else if (
      ["campaigns", "scans"].includes(collection) &&
      action === "gate"
    ) {
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
      this.validate(collection, next, state, session, id);
      Object.assign(record, body);
      if (["agents", "projects", "tools"].includes(collection))
        invalidate("Access bindings changed");
    } else
      throw new ApiError(
        404,
        "UNKNOWN_ACTION",
        "This action is not supported.",
      );
    record.version++;
    audit(`${collection} ${action || "updated"}`, str(record.name), id);
    return respond(record);
  }
  private validate(
    collection: Collection,
    body: Record<string, Json>,
    state: State,
    session: Session,
    id?: string,
  ) {
    const allowed = fields[collection] || [];
    requireValue(
      Object.keys(body).every((k) => allowed.includes(k)),
      `Unknown ${collection} field.`,
    );
    requireValue(
      str(body.name).trim().length >= 2,
      "Name must contain at least two characters.",
    );
    if (
      ownRoles.includes(session.role) &&
      ["projects", "agents"].includes(collection)
    )
      requireValue(
        body.owner === session.user,
        "Choose your own identity as owner.",
      );
    const reference = (field: string, target: Collection, optional = false) => {
      const value = str(body[field]);
      if (optional && !value) return;
      const r = state.data[target].find((r) => r.id === value);
      requireValue(r, `Select an existing ${field}.`);
      if (ownRoles.includes(session.role) && target === "projects")
        requireValue(
          r?.owner === session.user,
          "The application belongs to another owner.",
        );
    };
    if (collection === "projects") {
      reference("route", "routes");
      reference("policy", "policies");
      reference("budget", "budgets");
      requireValue(str(body.owner).trim(), "An owner is required.");
    }
    if (collection === "routes") {
      reference("primary", "providers");
      reference("fallback", "providers", true);
      requireValue(
        /^[a-z0-9][a-z0-9-]*$/.test(str(body.alias)),
        "Use a lowercase model alias with letters, numbers and hyphens.",
      );
      requireValue(
        num(body.threshold) >= 0 && num(body.threshold) <= 100,
        "Threshold must be 0–100.",
      );
      requireValue(
        num(body.retries) >= 0 && num(body.retries) <= 5,
        "Retry count must be 0–5.",
      );
    }
    if (collection === "budgets") {
      reference("parent", "budgets", true);
      let parent = str(body.parent),
        seen = new Set<string>();
      while (parent) {
        requireValue(
          parent !== id && !seen.has(parent),
          "Budget inheritance cannot contain a cycle.",
        );
        seen.add(parent);
        parent = str(state.data.budgets.find((b) => b.id === parent)?.parent);
      }
      requireValue(num(body.limit, -1) >= 0, "Budget cannot be negative.");
      requireValue(
        body.currency === "INR",
        "The demo ledger is denominated in INR.",
      );
      for (const f of ["rpm", "tokens", "concurrency"])
        requireValue(num(body[f]) >= 1, `${f} must be positive.`);
    }
    if (collection === "policies") {
      requireValue(
        num(body.maxTokens) >= 1 && num(body.maxTokens) <= 32768,
        "Output tokens must be 1–32768.",
      );
      requireValue(
        ["redact", "block", "monitor"].includes(str(body.pii)),
        "Choose a valid sensitive-data action.",
      );
      requireValue(
        arr(body.detectors).every((id) =>
          state.data.detectors.some((d) => d.id === id),
        ),
        "Select known detectors.",
      );
    }
    if (collection === "agents") {
      reference("project", "projects");
      requireValue(
        str(body.purpose).trim().length >= 5,
        "Declare the agent purpose.",
      );
      requireValue(
        num(body.maxSteps) >= 1 &&
          num(body.maxDuration) >= 1 &&
          num(body.maxDepth) >= 1,
        "Workflow limits must be positive.",
      );
      requireValue(
        arr(body.allowedTools).every((id) =>
          state.data.tools.some((t) => t.id === id),
        ),
        "Select registered tools.",
      );
    }
    if (["servers", "integrations"].includes(collection)) {
      try {
        const url = new URL(str(body.endpoint));
        requireValue(
          url.protocol === "https:" || url.hostname === "localhost",
          "Use HTTPS for non-local endpoints.",
        );
        requireValue(
          !url.username && !url.password,
          "Use a secret reference instead of credentials in the URL.",
        );
      } catch {
        throw new ApiError(422, "VALIDATION", "Enter a valid HTTPS endpoint.");
      }
    }
    if (["servers", "providers", "integrations"].includes(collection))
      requireValue(
        /^vault:\/\/|^arn:aws:secretsmanager:/.test(str(body.secret)),
        "Enter a Vault or Secrets Manager reference; do not enter a secret value.",
      );
    if (collection === "tools") {
      reference("serverId", "servers");
      requireValue(
        [
          "READ",
          "CREATE",
          "UPDATE",
          "DELETE",
          "FINANCIAL",
          "PRIVILEGED",
        ].includes(str(body.action)),
        "Choose an action classification.",
      );
      requireValue(
        num(body.expires) > Date.now(),
        "Permission expiry must be in the future.",
      );
    }
    if (collection === "exceptions") {
      requireValue(
        str(body.reason).trim().length >= 5,
        "Explain the exception request.",
      );
      requireValue(
        num(body.expires) > Date.now(),
        "Exception expiry must be in the future.",
      );
    }
    if (collection === "members") {
      requireValue(
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str(body.email)),
        "Enter a valid email address.",
      );
      requireValue(roles.includes(body.role as Role), "Choose a known role.");
      requireValue(
        !state.data.members.some(
          (m) =>
            m.id !== id &&
            str(m.email).toLowerCase() === str(body.email).toLowerCase(),
        ),
        "This email already exists.",
      );
    }
    if (["campaigns", "scans"].includes(collection)) {
      reference("target", "projects");
    }
  }
  private inspect(text: string, policy: Row, state: State) {
    const active = arr(policy.detectors).filter((id) =>
      state.data.detectors.some((d) => d.id === id && d.status === "Active"),
    );
    const signals: string[] = [];
    if (
      active.includes("pii") &&
      (/\b\d{12,16}\b/.test(text) ||
        /\b[A-Z]{5}\d{4}[A-Z]\b/.test(text) ||
        /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))
    )
      signals.push("Personal identifiers");
    if (
      active.includes("secrets") &&
      /\b(?:sk-|api_key[=: ]+)[a-z0-9_-]{8,}/i.test(text)
    )
      signals.push("Secret");
    if (
      active.includes("injection") &&
      /ignore (all |previous |the )?instructions|reveal (the )?system prompt|bypass.*safety/i.test(
        text,
      )
    )
      signals.push("Prompt injection");
    const order: Record<string, string> = {
      pii: "Personal identifiers",
      secrets: "Secret",
      injection: "Prompt injection",
    };
    signals.sort(
      (a, b) =>
        active.findIndex((id) => order[str(id)] === a) -
        active.findIndex((id) => order[str(id)] === b),
    );
    const block =
      (signals.includes("Prompt injection") && policy.injection === "block") ||
      (signals.length > 0 && policy.pii === "block");
    const decision =
      policy.mode === "monitor"
        ? "MONITOR"
        : block
          ? "DENY"
          : signals.length && policy.pii === "redact"
            ? "REDACT"
            : "ALLOW";
    return {
      decision,
      signals,
      text: decision === "REDACT" ? mask(text) : text,
      reason: signals.length
        ? `${signals.join(", ")} · ${decision.toLowerCase()}`
        : "Identity and configured sample checks passed",
    };
  }
  private budget(
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
        ? this.published(current, state.data.traces.length)
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
      if (
        used + cost >=
        (num(budget.limit) * num(budget.threshold, 80)) / 100
      ) {
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
  private budgetApproval(
    state: State,
    session: Session,
    project: Row,
    trace: Row,
    body: Record<string, Json>,
    budgetId: string,
  ) {
    const budget = this.published(
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
  private consumeBudgetApprovals(
    state: State,
    project: Row,
    body: Record<string, Json>,
  ) {
    for (const current of state.data.budgets) {
      const budget = this.published(current, state.data.traces.length);
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
  private published(row: Row, index: number): Row {
    if (
      row.status === "Canary" &&
      index % 100 >= num(row.canary, 10) &&
      arr(row.history).length
    )
      return {
        ...row,
        ...obj(arr(row.history).at(-1)),
        status: "Active",
      } as Row;
    return row;
  }
  private trace(kind: string, session: Session, project: Row): Row {
    return {
      id: uid("trace"),
      version: 1,
      ts: Date.now(),
      project: project.id,
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
  private runModel(
    state: State,
    session: Session,
    body: Record<string, Json>,
    find: (c: Collection, id: string) => Row,
    audit: (e: string, d: string, r?: string) => void,
  ): Row {
    const project = find("projects", str(body.project)),
      trace = this.trace("model", session, project),
      stages: Json[] = [];
    trace.stages = stages;
    const stage = (name: string, detail: string, status = "Passed") =>
      stages.push({ name, detail, status });
    const deny = (reason: string) => {
      trace.decision = "DENY";
      trace.reason = reason;
      stage("Execution stopped", reason, "Blocked");
      return trace;
    };
    if (project.status !== "Active" || project.keyStatus !== "Active")
      return deny("Application or virtual credential is inactive");
    stage("Identity", `${project.name} · ${session.user}`);
    const policy = this.published(
        find("policies", str(project.policy)),
        state.data.traces.length,
      ),
      route = this.published(
        find("routes", str(project.route)),
        state.data.traces.length,
      );
    trace.policyVersion = num(policy.publishedVersion, policy.version);
    trace.decisionId = uid("decision");
    if (
      !["Active", "Canary"].includes(str(policy.status)) ||
      !["Active", "Canary"].includes(str(route.status))
    )
      return deny("Publish the bound route and policy first");
    if (state.settings.controlPlane === "Unavailable")
      stage(
        "Policy cache",
        "Using the last published policy snapshot",
        "Cached",
      );
    const text = str(body.prompt),
      maxTokens = num(body.maxTokens, 1200);
    requireValue(text.trim(), "Enter a prompt.");
    if (maxTokens < 1 || maxTokens > num(policy.maxTokens))
      return deny("Requested output exceeds the active policy token limit");
    const inspection = this.inspect(text, policy, state);
    trace.preview = mask(inspection.text);
    trace.signals = inspection.signals;
    stage("Request guardrails", inspection.reason, inspection.decision);
    if (inspection.decision === "DENY") return deny(inspection.reason);
    const eligible = (id: string) => {
      const p = state.data.providers.find((p) => p.id === id);
      return (
        p &&
        p.status === "Healthy" &&
        (policy.region === "Any region" || str(p.region).startsWith("India"))
      );
    };
    const b = state.data.budgets.find((b) => b.id === project.budget),
      used = b ? budgetSpend(state, b) : 0;
    const preflight = this.budget(state, project, 0, body);
    const low =
      !!b &&
      ((num(b.limit) - used) / Math.max(1, num(b.limit))) * 100 <
        num(route.threshold);
    const fallback = preflight.route || str(route.fallback);
    const candidates = (
      low || preflight.route
        ? [fallback, str(route.primary)]
        : [str(route.primary), fallback]
    ).filter((id, i, a) => id && a.indexOf(id) === i && eligible(id));
    if (!candidates.length)
      return deny(
        "No healthy model deployment meets the active residency policy",
      );
    let selected = "",
      estimate = 0,
      blocked = preflight;
    for (const id of candidates) {
      const cost = round(
          Math.max(0.01, (maxTokens / 1000) * (id === fallback ? 0.35 : 0.9)),
        ),
        check = this.budget(state, project, cost, body);
      if (check.ok) {
        if (check.route && check.route !== id) {
          if (eligible(check.route) && !candidates.includes(check.route))
            candidates.push(check.route);
          blocked = {
            ok: false,
            reason:
              "The budget threshold requires its configured eligible fallback",
            decision: "DENY",
          };
          continue;
        }
        selected = id;
        estimate = cost;
        blocked = check;
        break;
      }
      blocked = check;
    }
    if (!selected) {
      trace.decision = blocked.decision || "DENY";
      trace.reason = blocked.reason;
      stage("Budget preflight", blocked.reason, trace.decision as string);
      if (blocked.budgetId)
        this.budgetApproval(
          state,
          session,
          project,
          trace,
          body,
          blocked.budgetId,
        );
      return trace;
    }
    if (blocked.notify)
      stage(
        "Budget notification",
        "The configured threshold alert was recorded",
      );
    this.consumeBudgetApprovals(state, project, body);
    stage(
      "Budget reservation",
      `INR ${estimate.toFixed(2)} reserved across the applicable budget hierarchy`,
    );
    trace.provider = selected;
    trace.target =
      state.data.providers.find((p) => p.id === selected)?.model || selected;
    stage(
      "Route",
      `${selected === route.primary ? "Primary" : "Fallback"} · ${trace.target}`,
    );
    if (body.failure === "timeout") {
      trace.reason =
        "Provider timeout; conservative estimate held pending reconciliation";
      trace.decision = "ERROR";
      trace.reservation = estimate;
      trace.cost = estimate;
      trace.pendingCost = true;
      trace.executed = true;
      stage("Provider", "Simulated timeout; charge pending", "Pending");
      trace.jobId = uid("job");
      state.data.jobs.push({
        id: str(trace.jobId),
        version: 1,
        collection: "traces",
        resource: trace.id,
        status: "Running",
        startedAt: Date.now(),
        readyAt: Date.now() + 1800,
      });
      return trace;
    }
    trace.executed = true;
    trace.cost = round(Math.max(0.01, estimate * 0.76));
    trace.tokens = Math.ceil(text.length / 4) + Math.floor(maxTokens * 0.73);
    trace.ms = selected === route.primary ? 847 : 618;
    trace.decision =
      selected === route.primary ? inspection.decision : "ROUTE_ALTERNATE";
    trace.reason =
      selected === route.primary
        ? inspection.reason
        : "An eligible fallback met policy and budget constraints";
    let output = text.includes("[demo:response-pii]")
      ? "Demo response: customer 123456789012 requires review."
      : `Demo response for ${project.name}: review the approved records and refer exceptions to the assigned reviewer.`;
    stage(
      "Provider execution",
      body.streaming
        ? `Simulated ${policy.streaming} stream`
        : "Sample provider response",
    );
    if (policy.response) {
      const response = this.inspect(
        output,
        { ...policy, pii: policy.responseAction || policy.pii },
        state,
      );
      stage("Response guardrails", response.reason, response.decision);
      if (response.decision === "DENY") {
        trace.decision = "DENY";
        trace.reason = "Response withheld; provider usage remains billable";
        output = "";
      } else {
        output = response.text;
        if (response.decision === "REDACT") trace.decision = "REDACT";
      }
    }
    trace.output = output;
    trace.reservation = 0;
    stage(
      "Usage and evidence",
      `INR ${trace.cost} committed; remaining reservation released`,
    );
    if (state.settings.rawContent)
      trace.content = { prompt: text, response: output };
    if (!state.data.assets.some((a) => a.linked === project.id))
      state.data.assets.push({
        id: uid("asset"),
        version: 1,
        name: project.name,
        type: "Application",
        owner: project.owner,
        risk: "Low",
        status: "Active",
        coverage: "Governed",
        linked: project.id,
        links: [
          project.route || "",
          project.policy || "",
          project.budget || "",
        ],
        bomVersion: 1,
        bomHistory: [],
      });
    return trace;
  }
  private runTool(
    state: State,
    session: Session,
    body: Record<string, Json>,
    find: (c: Collection, id: string) => Row,
    audit: (e: string, d: string, r?: string) => void,
  ): Row {
    const agent = find("agents", str(body.agent)),
      project = find("projects", str(agent.project)),
      tool = find("tools", str(body.tool)),
      trace = this.trace("tool", session, project),
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
    const policy = this.published(
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
    const check = this.inspect(JSON.stringify(args), policy, state);
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
    const budget = this.budget(state, project, 0.08, body);
    if (!budget.ok) {
      trace.decision = budget.decision || "DENY";
      trace.reason = budget.reason;
      stage("Budget preflight", budget.reason, trace.decision as string);
      if (budget.budgetId)
        this.budgetApproval(
          state,
          session,
          project,
          trace,
          body,
          budget.budgetId,
        );
      return trace;
    }
    this.consumeBudgetApprovals(state, project, body);
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
  private completeJobs(
    state: State,
    audit: (e: string, d: string, r?: string) => void,
  ) {
    for (const job of state.data.jobs.filter((j) => j.status === "Running")) {
      job.progress = Math.min(
        95,
        Math.round(
          ((Date.now() - num(job.startedAt)) /
            Math.max(1, num(job.readyAt) - num(job.startedAt))) *
            100,
        ),
      );
      if (num(job.readyAt) > Date.now()) continue;
      const collection = str(job.collection) as Collection,
        target = state.data[collection]?.find((r) => r.id === job.resource);
      if (!target) {
        job.status = "Cancelled";
        continue;
      }
      if (collection === "traces") {
        target.cost = round(num(target.cost) * 0.6);
        target.reservation = 0;
        target.pendingCost = false;
        target.reason = "Provider timeout reconciled from sample usage";
      } else {
        const pass = !!target.remediation;
        target.status = pass ? "Passed" : "Failed";
        target.findings = pass
          ? []
          : [
              {
                severity: "High",
                title:
                  collection === "scans"
                    ? "Unverified sample dependency"
                    : "Prompt injection regression",
                evidence: "Synthetic adverse case",
                remediation: "Bind and retest the baseline protection",
              },
            ];
        target.runHistory = [
          ...arr(target.runHistory),
          {
            ts: Date.now(),
            status: target.status,
            findings: target.findings,
            remediation: target.remediation || "",
          },
        ];
        target.gate = pass ? "Ready" : "Blocked";
        if (!pass)
          state.data.incidents.unshift({
            id: uid("INC"),
            version: 1,
            title: `${target.name}: assurance gate failed`,
            source: collection === "scans" ? "Supply chain" : "Red team",
            severity: "High",
            project: target.target || "",
            status: "Open",
            owner: "Security team",
            ts: Date.now(),
            reason:
              "Review sample exploit evidence, link remediation and retest.",
            notes: [],
            assurance: target.id,
          });
      }
      target.version++;
      job.status = "Completed";
      job.progress = 100;
      job.version++;
      audit("Completed sample job", str(target.name || target.id), target.id);
    }
  }
}
