import { arr, collections, num, str } from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { createState } from "../fixtures/seed";
import { moduleFor, ownRoles } from "../resources/schema";
import { mask, requireValue } from "../shared/values";
import { resolveCompanyConfig } from "@neurofence/contracts/company";
import { companySummary } from "../company/directory";

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
    const { company, directory } = ctx;
    scoped.company = {
      summary: companySummary(company),
      effective: resolveCompanyConfig(company, session.environment),
      permissions: session.permissions || [],
      identities: company.members
        .filter((m) => m.status === "Active")
        .map((m) => ({ id: m.id, name: m.name, roles: m.roles })),
      companies: directory.companies
        .filter(
          (c) =>
            session.role === "Neurofence operator" ||
            c.members.some(
              (m) =>
                m.status === "Active" &&
                m.roles.includes(session.role) &&
                (session.subject
                  ? m.subject === session.subject
                  : m.name === session.user),
            ),
        )
        .map(companySummary),
      ...([
        "Company admin",
        "Security admin",
        "Governance owner",
        "Auditor",
      ].includes(session.role)
        ? { administration: structuredClone(company) }
        : {}),
    };
    delete scoped.gatewayReceipts;
    delete scoped.policyLab;
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
    scoped.revision = state.revision + 1;
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
    const allowed = ["deployment", "controlPlane"];
    requireValue(
      Object.keys(body).every((k) => allowed.includes(k)),
      "Company settings are managed through Company administration drafts. Only demo deployment and control-plane scenarios can be changed here.",
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
      for (const trace of state.data.traces)
        if (!trace.legalHold) {
          delete trace.content;
          trace.contentRetained = false;
        }
    Object.assign(state.settings, body, {
      version: state.settings.version + 1,
    });
    audit("Updated workspace settings", str(body.name || state.settings.name));
    return respond(state.settings);
  }
}
