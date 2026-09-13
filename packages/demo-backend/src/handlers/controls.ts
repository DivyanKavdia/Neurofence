import { str } from "@neurofence/contracts/types";
import { CollectionContext } from "../context";
import { requireValue } from "../shared/values";

export function handleControls(ctx: CollectionContext) {
  const { collection } = ctx;
  const {
    body,
    id,
    action,
    state,
    permission,
    audit,
    respond,
    find,
    checkVersion,
  } = ctx;
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
}
