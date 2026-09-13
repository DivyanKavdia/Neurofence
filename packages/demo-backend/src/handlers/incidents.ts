import { arr, str } from "@neurofence/contracts/types";
import { CollectionContext } from "../context";
import { requireValue } from "../shared/values";

export function handleIncidents(ctx: CollectionContext) {
  const { collection } = ctx;
  const {
    session,
    body,
    id,
    action,
    state,
    permission,
    audit,
    respond,
    find,
    checkVersion,
    invalidate,
  } = ctx;
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
}
