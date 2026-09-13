import { Collection, num, str } from "@neurofence/contracts/types";
import { CollectionContext } from "../context";
import { requireValue } from "../shared/values";

export function handleApprovals(ctx: CollectionContext) {
  const { collection } = ctx;
  const {
    session,
    body,
    id,
    state,
    permission,
    audit,
    respond,
    find,
    checkVersion,
  } = ctx;
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
}
