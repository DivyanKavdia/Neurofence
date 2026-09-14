import { Company, moduleOptions } from "@neurofence/contracts/company";
import { ApiError, arr, str } from "@neurofence/contracts/types";
import { requireValue } from "../shared/values";
import { companySummary, makeCompany } from "./directory";
import { email, textValue, validateConfig } from "./validation";

import { CompanyCommand } from "./transaction";
import { snapshot } from "./config-snapshot";

export function handleOperatorCompanies(ctx: CompanyCommand) {
  const {
    directory,
    session,
    id,
    action,
    method,
    body,
    saveCompany,
    checkCompanyVersion,
  } = ctx;

  ctx.permission("companies");
  if (method === "GET")
    return ctx.respond(
      directory.companies.map((c) => ({
        ...companySummary(c),
        provisioning: c.provisioning,
      })),
      false,
    );
  if (!id && method === "POST") {
    requireValue(
      Object.keys(body).every((k) =>
        [
          "slug",
          "name",
          "ownerName",
          "ownerEmail",
          "environments",
          "entitlements",
        ].includes(k),
      ),
      "Unknown onboarding field.",
    );
    const slug = str(body.slug).trim().toLowerCase();
    requireValue(
      /^[a-z][a-z0-9-]{2,47}$/.test(slug),
      "Company identifier must be 3–48 lowercase letters, numbers or hyphens.",
    );
    requireValue(
      !directory.companies.some((c) => c.id === slug),
      "This company identifier already exists.",
    );
    textValue(body.name, "Company name");
    textValue(body.ownerName, "First company admin");
    email(body.ownerEmail);
    const environments = arr<string>(
      body.environments || ["Development", "Staging", "Production"],
    );
    requireValue(
      environments.length > 0 &&
        environments.length <= 10 &&
        environments.every(
          (e) =>
            typeof e === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(e),
        ) &&
        new Set(environments).size === environments.length,
      "Use unique environment names with letters, numbers, underscores or hyphens.",
    );
    const created = makeCompany(
      slug,
      str(body.name).trim(),
      str(body.ownerName).trim(),
      str(body.ownerEmail).toLowerCase(),
      environments,
    );
    if (body.entitlements) {
      created.entitlements = arr<string>(body.entitlements);
      requireValue(
        created.entitlements.includes("M9") &&
          created.entitlements.every((m) =>
            moduleOptions.some(([id]) => m === id),
          ),
        "Select valid entitlements including Governance.",
      );
      created.config.values.modules = created.entitlements;
      validateConfig(created.config, created);
      created.history[0] = {
        ...created.history[0],
        ...snapshot(created.config),
      };
    }
    directory.companies.push(created);
    return saveCompany(
      created,
      "Company created",
      `First demo administrator: ${body.ownerName}`,
    );
  }
  const target = directory.companies.find((c) => c.id === id);
  if (!target)
    throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");
  checkCompanyVersion(target);
  textValue(body.reason, "Operator reason", 1000);
  if (action === "status" && method === "POST") {
    requireValue(
      ["Active", "Suspended"].includes(str(body.status)),
      "Select Active or Suspended.",
    );
    requireValue(
      target.status !== "Onboarding",
      "The company admin must finish onboarding before operator suspension or restoration.",
    );
    target.status = body.status as Company["status"];
  } else if (action === "entitlements" && method === "POST") {
    const modules = arr<string>(body.modules);
    requireValue(
      modules.includes("M9") &&
        modules.every((m) => moduleOptions.some(([id]) => m === id)),
      "Select supported entitlements including Governance.",
    );
    requireValue(
      arr<string>(target.config.values.modules).every((m) =>
        modules.includes(m),
      ),
      "Ask the company admin to disable modules before removing their entitlements.",
    );
    target.entitlements = modules;
  } else if (action === "provisioning" && method === "POST") {
    const ticket = target.provisioning.find((r) => r.id === body.requestId);
    requireValue(ticket, "Provisioning request not found.");
    requireValue(
      ["Ready for provisioning", "Rejected"].includes(str(body.status)),
      "Select a provisioning review outcome.",
    );
    Object.assign(ticket!, {
      status: body.status,
      reviewReason: body.reason,
      reviewedBy: session.user,
      version: ticket!.version + 1,
    });
  } else throw new ApiError(404, "UNKNOWN_ACTION", "Unknown operator action.");
  return saveCompany(target, `Operator ${action}`, str(body.reason), {
    ...companySummary(target),
    provisioning: target.provisioning,
  });
}
