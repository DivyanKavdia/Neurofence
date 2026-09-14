import { ApiError, str, uid } from "@neurofence/contracts/types";
import { createState } from "../fixtures/seed";
import { requireValue } from "../shared/values";
import { textValue, validateConfig } from "./validation";

import { CompanyCommand } from "./transaction";

export function handleCompanySetup(ctx: CompanyCommand) {
  const { company, session, id, method, body, actor, saveCompany } = ctx;
  if (id === "environments" && method === "POST") {
    requireValue(
      /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(str(body.name)) &&
        company.environments.length < 10 &&
        !company.environments.includes(str(body.name)),
      "Enter a unique environment name (up to 40 characters); maximum 10 environments.",
    );
    company.environments.push(str(body.name));
    return saveCompany(company, "Environment added", str(body.name));
  }
  if (id === "activate" && method === "POST") {
    requireValue(
      company.status === "Onboarding",
      "This company has already completed onboarding.",
    );
    validateConfig(company.config, company);
    requireValue(
      company.members.some(
        (m) =>
          m.status === "Active" &&
          m.id !== actor &&
          m.roles.some((r) => r === "Security admin" || r === "Company admin"),
      ),
      "Activate a second administrator or security reviewer before completing onboarding.",
    );
    requireValue(
      !company.draft,
      "Publish or discard the outstanding configuration draft first.",
    );
    company.status = "Active";
    return saveCompany(
      company,
      "Company activated",
      "Company administration and independent review are ready for the demo runtime.",
    );
  }
  if (id === "starter" && method === "POST") {
    requireValue(
      !ctx.providerConnector,
      "Starter resources are available only with the dummy backend.",
    );
    requireValue(
      ctx.state.data.projects.length === 0 &&
        ctx.state.data.providers.length === 0,
      "Starter resources require an empty environment.",
    );
    const starter = createState(undefined, "acme");
    for (const collection of [
      "providers",
      "models",
      "projects",
      "routes",
      "policies",
      "budgets",
      "agents",
      "servers",
      "tools",
      "detectors",
    ] as const)
      ctx.state.data[collection] = starter.data[collection];
    for (const row of [...ctx.state.data.projects, ...ctx.state.data.agents]) {
      row.owner = session.user;
      if (row.environment) row.environment = session.environment;
    }
    ctx.state.revision++;
    ctx.persist();
    return saveCompany(
      company,
      "Starter resources created",
      `${session.environment}; dummy providers and governed applications, no live credentials`,
    );
  }
  if (id === "provisioning" && method === "POST") {
    requireValue(
      [
        "Dedicated deployment",
        "Residency migration",
        "Identity connection",
        "Notification delivery",
      ].includes(str(body.kind)),
      "Select a supported provisioning request.",
    );
    textValue(body.reason, "Request details", 1000);
    company.provisioning.unshift({
      id: uid("provision"),
      version: 1,
      kind: body.kind,
      reason: body.reason,
      status: "Requested",
      requestedBy: session.user,
      ts: Date.now(),
      environment: session.environment,
    });
    return saveCompany(
      company,
      "Provisioning requested",
      `${body.kind}; ${body.reason}`,
    );
  }
  throw new ApiError(
    404,
    "UNKNOWN_ACTION",
    "Unknown company administration action.",
  );
}
