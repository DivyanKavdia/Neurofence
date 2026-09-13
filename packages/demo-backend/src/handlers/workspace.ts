import { arr, collections, num, str } from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { createState } from "../fixtures/seed";
import { moduleFor, ownRoles } from "../resources/schema";
import { mask, requireValue } from "../shared/values";

export async function handleWorkspace(ctx: RequestContext) {
  const {
    session,
    correlationId,
    services,
    providerConnector,
    method,
    body,
    resource,
    key,
    state,
    permission,
    audit,
    respond,
    inScope,
    checkVersion,
  } = ctx;
  if (resource === "workspace" && method === "GET") {
    const scoped = structuredClone(state);
    delete scoped.gatewayReceipts;
    scoped.settings.modelRuntime = providerConnector?.mode || "mock";
    for (const c of collections) {
      scoped.data[c] = scoped.data[c].filter((r) => inScope(r, c));
      if (moduleFor[c] && !arr(state.settings.modules).includes(moduleFor[c]!))
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
      status: providerConnector ? await providerConnector.health() : "Healthy",
      mode: providerConnector?.mode || "mock",
      dependencies: providerConnector
        ? "LiteLLM model execution; prototype control plane"
        : "Simulated",
      controlPlane: state.settings.controlPlane,
    });
  if (resource === "session") return respond(session);
  if (resource === "reset" && method === "POST") {
    permission("settings");
    requireValue(
      !providerConnector && !Object.keys(state.gatewayReceipts || {}).length,
      "LiteLLM execution receipts must be retained. Use a separate mock data directory for a fresh demo workspace.",
    );
    services.store.write(key, createState(undefined, session.tenant));
    services.receipts.clear();
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
    audit("Updated workspace settings", str(body.name || state.settings.name));
    return respond(state.settings);
  }
}
