import { ApiError, arr } from "@neurofence/contracts/types";
import { requireValue } from "../shared/values";
import { RequestContext } from "../context";
import { assuranceOperation } from "../workflows/assurance";
import { detectorOperation } from "../workflows/detectors";
import { distributionOperation } from "../workflows/distribution";
import { evidenceOperation } from "../workflows/evidence";
import { finopsOperation } from "../workflows/finops";
import { inventoryOperation } from "../workflows/inventory";

/** Explicit workflow commands keep imports and lifecycle changes atomic. */
export async function handleOperations(ctx: RequestContext) {
  if (ctx.resource !== "operations") return;
  const handlers = {
    assurance: { module: "M9", run: assuranceOperation },
    inventory: { module: "M1", run: inventoryOperation },
    finops: { module: "M6", run: finopsOperation },
    evidence: { module: "M9", run: evidenceOperation },
    distribution: { module: "M9", run: distributionOperation },
    detectors: { module: "M3", run: detectorOperation },
  };
  const handler = handlers[ctx.id as keyof typeof handlers];
  if (!handler || ctx.method !== "POST")
    throw new ApiError(404, "UNKNOWN_ENDPOINT", "Unknown workflow command.");
  if (!arr(ctx.state.settings.modules).includes(handler.module))
    throw new ApiError(
      403,
      "MODULE_DISABLED",
      "This module is not enabled in the workspace.",
    );
  requireValue(
    JSON.stringify(ctx.body).length <= 1000000,
    "Workflow payload exceeds 1 MB.",
  );
  return handler.run(ctx);
}
