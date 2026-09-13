import { arr, num, str } from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { requireValue } from "../shared/values";

export function assuranceOperation(ctx: RequestContext) {
  const {
    action,
    body,
    find,
    permission,
    checkVersion,
    audit,
    respond,
    state,
  } = ctx;
  const collection = action === "schedule" ? "campaigns" : "scans";
  permission(collection);
  requireValue(
    arr(state.settings.modules).includes(
      collection === "campaigns" ? "M7" : "M8",
    ),
    "Enable the assurance module first.",
  );
  const row = find(collection, str(body.id));
  checkVersion(row);
  requireValue(
    row.status !== "Running",
    "Wait for this run to complete before changing its configuration.",
  );
  if (action === "schedule") {
    requireValue(
      ["Manual", "Daily", "Weekly"].includes(str(body.schedule)),
      "Choose a supported schedule.",
    );
    requireValue(
      body.schedule === "Manual" ||
        (num(body.nextRunAt) >= Date.now() &&
          num(body.nextRunAt) <= Date.now() + 366 * 86400000),
      "Schedule the next run within the coming year.",
    );
    row.schedule = body.schedule;
    row.scheduleEnabled = body.schedule !== "Manual";
    row.nextRunAt = row.scheduleEnabled ? body.nextRunAt : 0;
  } else if (action === "provenance") {
    requireValue(
      /^[a-f0-9]{64}$/i.test(str(body.digest)),
      "Enter the artifact's 64-character SHA-256 digest.",
    );
    requireValue(
      str(body.publisher).trim().length >= 2 &&
        str(body.license).trim().length >= 2,
      "Record a publisher and license identifier.",
    );
    const changed =
      row.digest !== body.digest ||
      row.publisher !== body.publisher ||
      row.license !== body.license;
    row.provenanceHistory = [
      ...arr(row.provenanceHistory),
      {
        at: Date.now(),
        digest: row.digest || "",
        publisher: row.publisher || "",
        license: row.license || "",
      },
    ];
    row.digest = str(body.digest).toLowerCase();
    row.publisher = str(body.publisher);
    row.license = str(body.license);
    if (changed) {
      row.status = "Quarantined";
      row.gate = "Blocked";
      row.provenance = "Changed · review required";
      delete row.remediation;
    }
  } else requireValue(false, "Unknown assurance operation.");
  row.version++;
  audit(`Updated assurance ${action}`, str(row.name), row.id);
  return respond(row);
}
