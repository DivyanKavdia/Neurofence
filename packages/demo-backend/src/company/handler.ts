import { resolveCompanyConfig } from "@neurofence/contracts/company";
import { ApiError } from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { requireValue } from "../shared/values";

import { companyTransaction } from "./transaction";
import { handleOperatorCompanies } from "./operator";
import { handleCompanyConfiguration } from "./configuration";
import { handleCompanyPeople } from "./people";
import { handleCompanySetup } from "./setup";

export function handleCompany(ctx: RequestContext) {
  const { resource, id, action, method, company, session } = ctx;
  if (resource !== "company" && resource !== "companies") return;
  const operator = session.role === "Neurofence operator";
  const readOnly = method === "GET";
  if (!readOnly)
    ctx.permission(
      resource === "companies"
        ? "companies"
        : id === "config" && ["approve", "reject"].includes(action)
          ? "companyReview"
          : "company",
    );
  const transaction = companyTransaction(ctx);
  const replay = transaction.replay();
  if (replay) return replay;
  const command = { ...ctx, ...transaction };
  if (resource === "companies") return handleOperatorCompanies(command);
  if (operator)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Select a company membership to manage company configuration.",
    );
  if (readOnly) {
    if (id === "effective") {
      const project = ctx.url.searchParams.get("project") || "";
      if (project) ctx.find("projects", project);
      return ctx.respond(
        resolveCompanyConfig(company, session.environment, project),
        false,
      );
    }
    if (id)
      throw new ApiError(
        404,
        "UNKNOWN_ACTION",
        "Unknown company read endpoint.",
      );
    requireValue(
      [
        "Company admin",
        "Security admin",
        "Governance owner",
        "Auditor",
      ].includes(session.role),
      "Company administration is unavailable for this role.",
    );
    return ctx.respond(company, false);
  }
  command.checkCompanyVersion();
  if (id === "config" && ["approve", "reject"].includes(action))
    ctx.permission("companyReview");
  else ctx.permission("company");

  if (id === "config" && method === "POST")
    return handleCompanyConfiguration(command);
  if (["members", "teams", "project-teams"].includes(id))
    return handleCompanyPeople(command);
  return handleCompanySetup(command);
}
