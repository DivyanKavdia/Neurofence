import {
  ApiError,
  arr,
  Json,
  num,
  obj,
  Row,
  str,
  uid,
} from "@neurofence/contracts/types";
import { CollectionContext } from "../context";
import { requireValue } from "../shared/values";
import { configCollections, fields } from "./schema";
import { validate } from "./validate";

export function updateConfiguration(ctx: CollectionContext, record: Row) {
  const { collection } = ctx;
  const { session, body, id, action, state, audit, respond, invalidate } = ctx;
  if (configCollections.includes(collection) && action) {
    if (action === "draft") {
      validate(collection, body, state, session, id);
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
}
