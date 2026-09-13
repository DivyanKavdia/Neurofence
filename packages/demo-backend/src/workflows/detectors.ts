import { arr, Row, str, uid } from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { requireValue } from "../shared/values";

export function detectorOperation(ctx: RequestContext) {
  const {
    action,
    body,
    state,
    permission,
    find,
    checkVersion,
    audit,
    respond,
  } = ctx;
  permission("detectors");
  requireValue(action === "save", "Unknown detector operation.");
  const old = body.id ? find("detectors", str(body.id)) : undefined;
  requireValue(
    !old || old.kind === "Dictionary",
    "Built-in detector implementations cannot be overwritten.",
  );
  if (old) checkVersion(old);
  const terms = [
      ...new Set(
        arr<string>(body.terms)
          .map((s) => str(s).trim())
          .filter(Boolean),
      ),
    ],
    stages = arr<string>(body.stages);
  requireValue(str(body.name).trim().length >= 2, "Name the detector.");
  requireValue(
    terms.length > 0 &&
      terms.length <= 100 &&
      terms.every((s) => s.length >= 2 && s.length <= 100),
    "Supply 1–100 literal terms, each 2–100 characters.",
  );
  requireValue(
    stages.length > 0 &&
      stages.every((s) =>
        ["Request", "Response", "Tool arguments", "Tool result"].includes(s),
      ),
    "Choose at least one inspection stage.",
  );
  const row: Row = {
    id: old?.id || uid("detector"),
    version: (old?.version || 0) + 1,
    name: str(body.name),
    kind: "Dictionary",
    terms,
    stages,
    stage: stages.join(" · "),
    status: old?.status || "Active",
    critical: false,
    latency: 1,
  };
  if (old) Object.assign(old, row);
  else state.data.detectors.unshift(row);
  audit(
    "Saved dictionary detector",
    `${row.name} · ${terms.length} literal rules`,
    row.id,
  );
  return respond(row);
}
