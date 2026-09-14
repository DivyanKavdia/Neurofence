import {
  Company,
  CompanyConfig,
  ConfigHistory,
  Membership,
  moduleOptions,
  resolveCompanyConfig,
} from "@neurofence/contracts/company";
import {
  ApiError,
  arr,
  can,
  Json,
  Role,
  roles,
  Row,
  str,
  uid,
} from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { createState } from "../fixtures/seed";
import { canonical, requireValue } from "../shared/values";
import { companySummary, makeCompany, resolveMembership } from "./directory";
import { email, parseConfig, textValue, validateConfig } from "./validation";

const asJson = (value: unknown): Json => JSON.parse(JSON.stringify(value));
const snapshot = (config: CompanyConfig): CompanyConfig =>
  structuredClone({
    values: config.values,
    locked: config.locked,
    overrides: config.overrides,
    rolePermissions: config.rolePermissions,
  });

export function handleCompany(ctx: RequestContext) {
  const {
    resource,
    id,
    action,
    method,
    body,
    company,
    directory,
    session,
    services,
    request,
  } = ctx;
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
  const receiptKey = `${session.tenant}:${session.subject || session.user}:${session.role}:${request.idempotencyKey}`;
  const payload = canonical({
    path: request.path,
    method,
    body,
    version: request.version ?? null,
  });
  const receipt = directory.receipts[receiptKey];
  if (!readOnly && receipt) {
    if (receipt.payload !== payload)
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This company request key was already used with different values.",
      );
    return ctx.respond(receipt.data, false);
  }
  const actor = operator ? "operator" : resolveMembership(company, session).id;
  const audit = (c: Company, event: string, detail: string) =>
    c.audit.unshift({
      id: uid("company-event"),
      version: 1,
      ts: Date.now(),
      actor: session.user,
      subject: actor,
      role: session.role,
      event,
      detail,
      tenant: c.id,
    });
  const save = (c: Company, event: string, detail: string, data?: unknown) => {
    c.version++;
    audit(c, event, detail);
    directory.revision++;
    const output = data ? { ...(data as object), version: c.version } : c;
    directory.receipts[receiptKey] = { payload, data: asJson(output) };
    // Bound demo receipt storage while preserving retries across HTTP restarts.
    const keys = Object.keys(directory.receipts);
    for (const key of keys.slice(0, Math.max(0, keys.length - 100)))
      delete directory.receipts[key];
    for (const key of keys) {
      if (
        key === receiptKey ||
        JSON.stringify(directory.receipts).length <= 750000
      )
        break;
      delete directory.receipts[key];
    }
    services.store.writeDirectory(directory);
    return ctx.respond(output, false);
  };
  const version = (c = company) => ctx.checkVersion(c as unknown as Row);
  const admin = () => ctx.permission("company");
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
  if (resource === "companies") {
    ctx.permission("companies");
    if (readOnly)
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
      return save(
        created,
        "Company created",
        `First demo administrator: ${body.ownerName}`,
      );
    }
    const target = directory.companies.find((c) => c.id === id);
    if (!target)
      throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");
    version(target);
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
    } else
      throw new ApiError(404, "UNKNOWN_ACTION", "Unknown operator action.");
    return save(target, `Operator ${action}`, str(body.reason), {
      ...companySummary(target),
      provisioning: target.provisioning,
    });
  }
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
  version();
  if (id === "config" && ["approve", "reject"].includes(action))
    ctx.permission("companyReview");
  else admin();

  if (id === "config" && method === "POST") {
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
          d.status === "Approved" &&
            d.approvedBy &&
            d.approvedBy !== d.createdBy,
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
    return save(
      company,
      `Company configuration ${action}`,
      str(
        body.reason ||
          company.draft?.reason ||
          `Published v${company.publishedVersion}`,
      ),
    );
  }
  if (id === "members") {
    if (method === "POST" && !action) {
      requireValue(
        Object.keys(body).every((k) =>
          ["name", "email", "roles", "teams"].includes(k),
        ),
        "Unknown membership field.",
      );
      textValue(body.name, "Member name");
      email(body.email);
      const member: Membership = {
        id: uid("member"),
        version: 1,
        name: str(body.name).trim(),
        email: str(body.email).toLowerCase(),
        subject: uid(`demo:${company.id}`),
        roles: body.roles as Role[],
        teams: arr<string>(body.teams),
        status: "Invited",
      };
      validateMember(member, company);
      company.members.push(member);
      return save(
        company,
        "Member invited",
        `${member.name}; demo invitation, no email sent`,
      );
    }
    const member = company.members.find((m) => m.id === action);
    requireValue(member, "Member not found in this company.");
    requireValue(
      method === "PATCH" &&
        Object.keys(body).every((k) =>
          ["name", "email", "roles", "teams", "status", "reason"].includes(k),
        ),
      "Use a versioned membership update.",
    );
    textValue(body.reason, "Membership change reason", 1000);
    const next = {
      ...member!,
      ...body,
      subject: member!.subject,
      id: member!.id,
      version: member!.version + 1,
    } as Membership;
    validateMember(next, company);
    requireValue(
      (next.status === "Active" && next.roles.includes("Company admin")) ||
        company.members.some(
          (m) =>
            m.id !== next.id &&
            m.status === "Active" &&
            m.roles.includes("Company admin"),
        ),
      "Keep at least one active company admin.",
    );
    requireValue(
      next.id !== actor ||
        (next.status === "Active" &&
          next.roles.includes(session.role) &&
          next.name === member!.name),
      "Ask another administrator to change your current identity or revoke your active role.",
    );
    Object.assign(member!, next);
    return save(
      company,
      "Membership updated",
      `${member!.name}; ${body.reason}`,
    );
  }
  if (id === "teams") {
    requireValue(
      Object.keys(body).every((k) =>
        ["name", "department", "costCenter", "reason"].includes(k),
      ),
      "Unknown team field.",
    );
    if (method === "DELETE") {
      const team = company.teams.find((t) => t.id === action);
      requireValue(team, "Team not found.");
      requireValue(
        !company.members.some((m) => m.teams.includes(action)) &&
          !company.projectTeams.some((p) => p.team === action) &&
          !company.config.overrides.some(
            (o) => o.scope === "team" && o.target === action,
          ) &&
          !company.draft?.overrides.some(
            (o) => o.scope === "team" && o.target === action,
          ),
        "Remove team assignments and overrides before deleting this team.",
      );
      company.teams = company.teams.filter((t) => t.id !== action);
    } else {
      requireValue(
        method === "POST" || method === "PATCH",
        "Use POST to create or PATCH to update a team.",
      );
      textValue(body.name, "Team name");
      textValue(body.department, "Department");
      textValue(body.costCenter, "Cost center");
      requireValue(
        !company.teams.some(
          (t) =>
            t.id !== action &&
            t.name.toLowerCase() === str(body.name).toLowerCase(),
        ),
        "Team names must be unique.",
      );
      if (action) {
        const team = company.teams.find((t) => t.id === action);
        requireValue(team, "Team not found.");
        Object.assign(team!, {
          name: body.name,
          department: body.department,
          costCenter: body.costCenter,
          version: team!.version + 1,
        });
      } else
        company.teams.push({
          id: uid("team"),
          version: 1,
          name: str(body.name),
          department: str(body.department),
          costCenter: str(body.costCenter),
        });
    }
    return save(
      company,
      `Team ${method.toLowerCase()}`,
      str(body.name || action),
    );
  }
  if (id === "project-teams" && method === "POST") {
    const project = ctx.find("projects", str(body.project));
    requireValue(
      !body.team || company.teams.some((t) => t.id === body.team),
      "Select a team from this company.",
    );
    company.projectTeams = company.projectTeams.filter(
      (p) => p.environment !== session.environment || p.project !== project.id,
    );
    if (body.team)
      company.projectTeams.push({
        environment: session.environment,
        project: project.id,
        team: str(body.team),
      });
    validateConfig(company.config, company);
    return save(
      company,
      "Project team assigned",
      `${project.name} → ${body.team || "No team"}`,
    );
  }
  if (id === "environments" && method === "POST") {
    requireValue(
      /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(str(body.name)) &&
        company.environments.length < 10 &&
        !company.environments.includes(str(body.name)),
      "Enter a unique environment name (up to 40 characters); maximum 10 environments.",
    );
    company.environments.push(str(body.name));
    return save(company, "Environment added", str(body.name));
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
    return save(
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
    return save(
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
    return save(
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

function validateMember(member: Membership, company: Company) {
  textValue(member.name, "Member name");
  email(member.email);
  requireValue(
    ["Invited", "Active", "Suspended"].includes(member.status),
    "Choose a valid membership status.",
  );
  requireValue(
    Array.isArray(member.roles) &&
      member.roles.length > 0 &&
      new Set(member.roles).size === member.roles.length &&
      member.roles.every(
        (r) => roles.includes(r) && r !== "Neurofence operator",
      ),
    "Assign valid company roles. Operator access cannot be granted by a company.",
  );
  requireValue(
    Array.isArray(member.teams) &&
      member.teams.every((t) => company.teams.some((team) => team.id === t)),
    "Assign teams from this company.",
  );
  requireValue(
    !company.members.some(
      (m) =>
        m.id !== member.id &&
        (m.email.toLowerCase() === member.email.toLowerCase() ||
          m.name.toLowerCase() === member.name.toLowerCase()),
    ),
    "A member with this name or email already exists.",
  );
  if (
    arr(company.config.values.domains).length &&
    !company.members.some((m) => m.id === member.id && m.email === member.email)
  )
    requireValue(
      arr<string>(company.config.values.domains).includes(
        member.email.split("@")[1].toLowerCase(),
      ),
      "The member email must belong to an approved company domain.",
    );
}
