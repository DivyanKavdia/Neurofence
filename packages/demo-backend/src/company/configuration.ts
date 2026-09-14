import { CompanyConfig, ConfigHistory } from "@neurofence/contracts/company";
import { ApiError, can, str } from "@neurofence/contracts/types";
import { requireValue } from "../shared/values";
import { parseConfig, textValue, validateConfig } from "./validation";

import { CompanyCommand } from "./transaction";
import { snapshot } from "./config-snapshot";

export function handleCompanyConfiguration(ctx: CompanyCommand) {
  const { company, session, services, action, body, actor, saveCompany } = ctx;
  const assertReferences = (config: CompanyConfig) => {
    for (const override of config.overrides)
      if (override.scope === "project") {
        const state =
          override.environment === session.environment
            ? ctx.state
            : services.store.read(`${company.id}:${override.environment}`);
        requireValue(
          state?.data.projects.some((p) => p.id === override.target),
          "The override project is unavailable in that environment.",
        );
      }
  };

  const draft = company.draft;
  if (action === "draft") {
    textValue(body.reason, "Change reason", 1000);
    const config = parseConfig(body, company);
    assertReferences(config);
    company.draft = {
      ...config,
      status: "Draft",
      createdBy: actor,
      reason: str(body.reason),
      baseVersion: company.publishedVersion,
    };
  } else if (action === "rollback") {
    textValue(body.reason, "Rollback reason", 1000);
    const previous = company.history.find(
      (h) => h.version === body.targetVersion,
    );
    requireValue(
      previous && previous.version !== company.publishedVersion,
      "Select an earlier published version.",
    );
    validateConfig(previous!, company);
    assertReferences(previous!);
    company.draft = {
      ...snapshot(previous!),
      status: "Draft",
      createdBy: actor,
      reason: str(body.reason),
      baseVersion: company.publishedVersion,
    };
  } else if (action === "discard") {
    requireValue(draft, "There is no draft to discard.");
    company.draft = null;
  } else {
    requireValue(
      draft && draft.baseVersion === company.publishedVersion,
      "Create a current company draft first.",
    );
    const d = draft!;
    if (action === "validate") {
      validateConfig(d, company);
      assertReferences(d);
      d.status = "Validated";
      d.validatedAt = Date.now();
      delete d.approvedBy;
    } else if (action === "submit") {
      requireValue(
        d.status === "Validated",
        "Validate the draft before requesting review.",
      );
      d.status = "Pending";
    } else if (action === "approve" || action === "reject") {
      requireValue(
        d.status === "Pending",
        "Submit the draft for review first.",
      );
      requireValue(
        d.createdBy !== actor,
        "An independent administrator must review this change.",
      );
      textValue(body.reason, "Review reason", 1000);
      d.status = action === "approve" ? "Approved" : "Draft";
      if (action === "approve") d.approvedBy = actor;
      else delete d.approvedBy;
    } else if (action === "publish") {
      requireValue(
        d.status === "Approved" && d.approvedBy && d.approvedBy !== d.createdBy,
        "An independently approved draft is required before publishing.",
      );
      const reviewer = company.members.find((m) => m.id === d.approvedBy);
      requireValue(
        reviewer?.status === "Active" &&
          reviewer.roles.some(
            (role) =>
              can(
                { ...session, role, permissions: undefined },
                "companyReview",
              ) &&
              (!company.config.rolePermissions[role] ||
                company.config.rolePermissions[role]!.includes(
                  "companyReview",
                )),
          ),
        "The approving reviewer must still hold an active review role.",
      );
      validateConfig(d, company);
      assertReferences(d);
      company.config = snapshot(d);
      company.publishedVersion++;
      company.name = str(d.values.name);
      const revision: ConfigHistory = {
        ...snapshot(d),
        version: company.publishedVersion,
        publishedAt: Date.now(),
        publishedBy: session.user,
        reason: d.reason,
      };
      company.history.push(revision);
      company.draft = null;
      // Existing resource policies stay versioned independently. Runtime evaluates both layers.
    } else
      throw new ApiError(
        404,
        "UNKNOWN_ACTION",
        "Unknown company configuration action.",
      );
  }
  return saveCompany(
    company,
    `Company configuration ${action}`,
    str(
      body.reason ||
        company.draft?.reason ||
        `Published v${company.publishedVersion}`,
    ),
  );
}
