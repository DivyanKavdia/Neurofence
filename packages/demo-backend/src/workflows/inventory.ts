import {
  arr,
  Json,
  num,
  obj,
  Row,
  State,
  str,
  uid,
} from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { canonical, requireValue } from "../shared/values";

export function assessRisk(asset: Row, weights: Record<string, Json> = {}) {
  const factors = [
    {
      name: "No active protection",
      points: asset.coverage === "Governed" ? 0 : num(weights.protection, 35),
    },
    {
      name: "Missing accountable owner",
      points:
        !str(asset.owner).trim() || asset.owner === "Unassigned"
          ? num(weights.ownership, 20)
          : 0,
    },
    {
      name: "Sensitive or unclassified data",
      points: ["Public", "Internal"].includes(str(asset.classification))
        ? 0
        : num(weights.classification, 25),
    },
    {
      name: "Approval not recorded",
      points: ["Approved", "Active"].includes(str(asset.status))
        ? 0
        : num(weights.approval, 20),
    },
  ];
  const score = factors.reduce((sum, f) => sum + f.points, 0);
  return {
    riskScore: score,
    assessedRisk:
      score >= 75
        ? "Critical"
        : score >= 50
          ? "High"
          : score >= 25
            ? "Medium"
            : "Low",
    riskContributors: factors,
  };
}

export function refreshRisk(state: State) {
  for (const asset of state.data.assets)
    Object.assign(asset, assessRisk(asset, obj(state.settings.riskWeights)));
}

/** A normalized import boundary; no network discovery or arbitrary SBOM execution. */
export function inventoryOperation(ctx: RequestContext) {
  const { action, body, state, permission, respond, audit } = ctx;
  permission("assets");
  if (action === "weights") {
    ctx.checkVersion(state.settings);
    const keys = ["protection", "ownership", "classification", "approval"];
    requireValue(
      keys.every(
        (k) =>
          typeof body[k] === "number" &&
          Number.isInteger(body[k]) &&
          num(body[k]) >= 0,
      ) && keys.reduce((sum, k) => sum + num(body[k]), 0) === 100,
      "Risk weights must be nonnegative integers adding up to 100.",
    );
    state.settings.riskWeights = Object.fromEntries(
      keys.map((k) => [k, body[k]]),
    );
    state.settings.version++;
    refreshRisk(state);
    audit("Updated asset risk weights", canonical(state.settings.riskWeights));
    return respond(state.settings.riskWeights);
  }
  requireValue(
    ["preview", "import"].includes(action),
    "Choose preview or import.",
  );
  const source = str(body.source).trim();
  requireValue(
    /^[a-zA-Z0-9._-]{2,80}$/.test(source),
    "Source must be a stable 2–80 character identifier.",
  );
  const entries = arr<Record<string, Json>>(body.entries);
  requireValue(
    entries.length > 0 && entries.length <= 250,
    "Import 1–250 normalized asset records.",
  );
  const seen = new Set<string>();
  const preview = entries.map((entry) => {
    const value = obj(entry),
      externalId = str(value.externalId).trim();
    requireValue(
      externalId.length > 0 &&
        externalId.length <= 150 &&
        !seen.has(externalId),
      "Each externalId must be unique within this batch and at most 150 characters.",
    );
    seen.add(externalId);
    requireValue(
      str(value.name).trim().length >= 2 && str(value.name).length <= 200,
      "Every asset needs a name of 2–200 characters.",
    );
    requireValue(
      [
        "Application",
        "Agent",
        "Model",
        "Dataset",
        "MCP server",
        "Tool",
      ].includes(str(value.type)),
      "Choose a supported asset type.",
    );
    requireValue(
      ["Public", "Internal", "Confidential", "Restricted", "Unknown"].includes(
        str(value.classification || "Unknown"),
      ),
      "Choose a valid data classification.",
    );
    requireValue(
      arr(value.links).every((id) =>
        state.data.assets.some((a) => a.id === id),
      ),
      "Links must identify existing inventory assets.",
    );
    const old = state.data.assets.find(
      (a) => a.importSource === source && a.externalId === externalId,
    );
    const discovered = {
      name: str(value.name).trim(),
      type: value.type,
      classification: value.classification || "Unknown",
      discoveredOwner: str(value.owner),
      components: arr(value.components).slice(0, 200),
      links: arr(value.links),
    };
    requireValue(
      JSON.stringify(discovered.components).length <= 30000,
      "Component metadata exceeds the import limit.",
    );
    const unchanged = old?.importFingerprint === canonical(discovered);
    const next: Row = {
      ...old,
      id: old?.id || uid("asset"),
      version: old ? old.version + (unchanged ? 0 : 1) : 1,
      ...discovered,
      owner: old?.owner || str(value.owner).trim() || "Unassigned",
      coverage: old?.coverage || "Unprotected",
      status: old?.status || "Discovered",
      importSource: source,
      externalId,
      importFingerprint: canonical(discovered),
      bomVersion: old ? num(old.bomVersion, 1) + (unchanged ? 0 : 1) : 1,
      bomHistory: arr(old?.bomHistory),
      ts: old?.ts || Date.now(),
      lastSeen: Date.now(),
    };
    if (old && !unchanged)
      next.bomHistory = [
        ...arr(old.bomHistory),
        {
          version: num(old.bomVersion, 1),
          at: Date.now(),
          name: old.name || "",
          components: old.components || [],
          source,
        },
      ];
    Object.assign(next, assessRisk(next, obj(state.settings.riskWeights)));
    return {
      change: !old ? "Create" : unchanged ? "Unchanged" : "Update",
      asset: next,
    };
  });
  if (action === "preview") return respond(preview, false);
  for (const { asset } of preview) {
    const index = state.data.assets.findIndex((a) => a.id === asset.id);
    if (index < 0) state.data.assets.unshift(asset);
    else state.data.assets[index] = asset;
  }
  audit(
    "Imported inventory",
    `${source}: ${preview.filter((p) => p.change === "Create").length} created, ${preview.filter((p) => p.change === "Update").length} updated`,
  );
  return respond(preview);
}
