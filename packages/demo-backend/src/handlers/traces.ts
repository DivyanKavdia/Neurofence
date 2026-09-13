import { CollectionContext } from "../context";
import { requireValue } from "../shared/values";

export function handleTraceActions(ctx: CollectionContext) {
  const { collection } = ctx;
  const { session, id, action, state, permission, audit, respond, find } = ctx;
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
}
