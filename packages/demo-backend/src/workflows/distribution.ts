import {
  arr,
  Json,
  num,
  Row,
  State,
  str,
  uid,
} from "@neurofence/contracts/types";
import { fields } from "../resources/schema";
import { RequestContext } from "../context";
import { canonical, hash, requireValue } from "../shared/values";

export function configurationPayload(state: State) {
  const payload: Record<string, Json> = {};
  for (const collection of ["policies", "routes", "budgets"] as const) {
    payload[collection] = state.data[collection]
      .filter((row) => ["Active", "Canary"].includes(str(row.status)))
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(
            ([key, value]) =>
              value !== undefined &&
              [
                ...(fields[collection] || []),
                "id",
                "publishedVersion",
                "status",
                "canary",
                "history",
              ].includes(key),
          ),
        ),
      ) as Json;
  }
  payload.detectors = JSON.parse(JSON.stringify(state.data.detectors));
  payload.companyConfigVersion = state.settings.companyConfigVersion || 1;
  return canonical(payload);
}

export function distributionFailure(state: State) {
  if (!state.settings.managedDistribution) return "";
  const bundle = state.data.distributions[0];
  if (!bundle || bundle.status !== "Acknowledged")
    return "The data plane has not acknowledged the latest policy bundle";
  if (num(bundle.expiresAt) <= Date.now())
    return "The acknowledged policy bundle expired; execution fails closed";
  if (bundle.payload !== configurationPayload(state))
    return "Published configuration changed; distribute and acknowledge a new bundle";
  return "";
}

export async function distributionOperation(ctx: RequestContext) {
  const {
    action,
    body,
    state,
    session,
    permission,
    respond,
    audit,
    find,
    checkVersion,
  } = ctx;
  permission("distribution");
  if (action === "build") {
    requireValue(
      state.settings.controlPlane !== "Unavailable",
      "Restore the control plane before building a bundle.",
    );
    requireValue(
      Number.isInteger(body.ttl) &&
        num(body.ttl) >= 60 &&
        num(body.ttl) <= 86400,
      "Bundle lifetime must be 60–86400 seconds.",
    );
    const payload = configurationPayload(state);
    const bundle: Row = {
      id: uid("bundle"),
      version: 1,
      name: `Bundle ${state.data.distributions.length + 1}`,
      status: "Pending",
      payload,
      sha256: await hash(payload),
      expiresAt: Date.now() + num(body.ttl) * 1000,
      ts: Date.now(),
      tenant: session.tenant,
      environment: session.environment,
      attempts: [],
    };
    state.data.distributions.unshift(bundle);
    state.settings.managedDistribution = true;
    state.settings.version++;
    audit(
      "Built policy distribution bundle",
      "SHA-256 integrity manifest; awaiting simulated data-plane acknowledgement",
      bundle.id,
    );
    return respond(bundle);
  }
  if (action === "acknowledge") {
    const bundle = find("distributions", str(body.bundle));
    checkVersion(bundle);
    requireValue(
      bundle.id === state.data.distributions[0]?.id &&
        bundle.status !== "Acknowledged",
      "Acknowledge the latest pending bundle.",
    );
    requireValue(
      num(bundle.expiresAt) > Date.now() &&
        bundle.payload === configurationPayload(state),
      "Bundle expired or configuration changed. Build a fresh bundle.",
    );
    requireValue(
      (await hash(str(bundle.payload))) === bundle.sha256,
      "Bundle integrity check failed.",
    );
    requireValue(
      ["success", "failure"].includes(str(body.outcome)),
      "Choose an acknowledgement outcome.",
    );
    bundle.attempts = [
      ...arr(bundle.attempts),
      { at: Date.now(), outcome: body.outcome || "", actor: session.user },
    ];
    bundle.status = body.outcome === "success" ? "Acknowledged" : "Failed";
    bundle.version++;
    audit(
      "Recorded simulated data-plane acknowledgement",
      str(bundle.status),
      bundle.id,
    );
    return respond(bundle);
  }
  requireValue(false, "Unknown distribution operation.");
}
