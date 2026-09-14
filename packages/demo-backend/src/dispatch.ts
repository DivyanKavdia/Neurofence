import {
  ApiError,
  arr,
  Collection,
  collections,
  Request,
  Result,
  Session,
} from "@neurofence/contracts/types";
import {
  BackendServices,
  createRequestContext,
  replayReceipt,
} from "./context";
import { completeJobs } from "./execution/jobs";
import { handleApprovals } from "./handlers/approvals";
import { handleControls } from "./handlers/controls";
import { handleIncidents } from "./handlers/incidents";
import { handleOperations } from "./handlers/operations";
import { refreshRisk } from "./workflows/inventory";
import { handleRuntime } from "./handlers/runtime";
import { handleTraceActions } from "./handlers/traces";
import { handleWorkspace } from "./handlers/workspace";
import { handleCompany } from "./company/handler";
import { handlePolicyLab } from "./workflows/policy-lab";
import { handleDemo } from "./workflows/demo";
import { updateResource } from "./resources/actions";
import { createResource } from "./resources/create";
import { deleteResource } from "./resources/delete";
import { updateConfiguration } from "./resources/lifecycle";
import { readCollection } from "./resources/read";
import { moduleFor } from "./resources/schema";

/** Route one serialized transaction through the shared browser/HTTP handlers. */
export async function dispatch(
  request: Request,
  session: Session,
  services: BackendServices,
): Promise<Result> {
  const ctx = createRequestContext(request, session, services);
  const replay = replayReceipt(ctx);
  if (replay) return replay;
  const company = handleCompany(ctx);
  if (company) return company;
  const demo = await handleDemo(ctx);
  if (demo) return demo;
  const policyLab = await handlePolicyLab(ctx);
  if (policyLab) return policyLab;
  completeJobs(ctx.state, ctx.audit);
  refreshRisk(ctx.state);
  const operation = await handleOperations(ctx);
  if (operation) return operation;
  const workspace = await handleWorkspace(ctx);
  if (workspace) return workspace;
  const runtime = await handleRuntime(ctx);
  if (runtime) return runtime;
  if (!collections.includes(ctx.resource as Collection))
    throw new ApiError(
      404,
      "UNKNOWN_ENDPOINT",
      "This API endpoint is unavailable.",
    );
  const collection = ctx.resource as Collection;
  if (collection === "members" && ctx.method !== "GET")
    throw new ApiError(
      409,
      "COMPANY_MEMBERS_MANAGED",
      "Manage memberships in Company administration. Environment-level member writes are disabled.",
    );
  if (
    moduleFor[collection] &&
    !arr(ctx.state.settings.modules).includes(moduleFor[collection]!)
  )
    throw new ApiError(
      403,
      "MODULE_DISABLED",
      "This module is not enabled in the workspace.",
    );
  const scoped = { ...ctx, collection };
  if (ctx.method === "GET") return readCollection(scoped);
  for (const handle of [
    handleTraceActions,
    handleApprovals,
    handleIncidents,
    handleControls,
  ]) {
    const result = handle(scoped);
    if (result) return result;
  }
  ctx.permission(collection);
  if (ctx.method === "DELETE") return deleteResource(scoped);
  if (!ctx.id) return createResource(scoped);
  const record = ctx.find(collection, ctx.id);
  ctx.checkVersion(record);
  const configuration = updateConfiguration(scoped, record);
  if (configuration) return configuration;
  return updateResource(scoped, record);
}
