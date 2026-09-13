import { str } from "@neurofence/contracts/types";
import { CollectionContext } from "../context";
import { requireValue } from "../shared/values";

export function deleteResource(ctx: CollectionContext) {
  const { collection } = ctx;
  const { body, id, state, audit, respond, find, checkVersion } = ctx;
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
  state.data[collection] = state.data[collection].filter((r) => r.id !== id);
  audit(`Removed ${collection}`, str(record.name), id);
  return respond({ deleted: id });
}
