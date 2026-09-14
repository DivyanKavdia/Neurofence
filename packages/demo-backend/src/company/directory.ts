import {
  Company,
  CompanyConfig,
  CompanyDirectory,
  companyDefaults,
  Membership,
} from "@neurofence/contracts/company";
import {
  ApiError,
  capabilities,
  Role,
  roles,
  Session,
  str,
  users,
} from "@neurofence/contracts/types";
import { Store } from "../stores/store";

export const templatePermissions = (role: Role) =>
  Object.entries(capabilities)
    .filter(([, allowed]) => allowed.includes(role))
    .map(([key]) => key);
export const companySummary = (c: Company) => ({
  id: c.id,
  version: c.version,
  name: c.name,
  status: c.status,
  environments: c.environments,
  entitlements: c.entitlements,
});

export function makeCompany(
  id: string,
  name: string,
  owner: string,
  email: string,
  environments = ["Development", "Staging", "Production"],
): Company {
  const config: CompanyConfig = {
    values: { ...structuredClone(companyDefaults), name },
    locked: [],
    overrides: [],
    rolePermissions: {},
  };
  return {
    id,
    version: 1,
    name,
    status: "Onboarding",
    environments,
    entitlements: [...(companyDefaults.modules as string[])],
    members: [
      {
        id: `${id}-owner`,
        version: 1,
        name: owner,
        email,
        subject: `demo:${id}:owner`,
        roles: ["Company admin"],
        teams: [],
        status: "Active",
      },
    ],
    teams: [],
    projectTeams: [],
    config,
    publishedVersion: 1,
    draft: null,
    history: [
      {
        ...structuredClone(config),
        version: 1,
        publishedAt: Date.now(),
        publishedBy: "Company onboarding",
        reason: "Initial defaults",
      },
    ],
    audit: [],
    provisioning: [],
    createdAt: Date.now(),
  };
}

/** One migration of the two existing demos. Unknown tenant strings never create companies. */
export function loadDirectory(store: Store): CompanyDirectory {
  const saved = store.readDirectory();
  if (saved) return structuredClone(saved);
  const companies = ["acme", "northstar"].map((id) => {
    const legacy = store.read(`${id}:Development`);
    const c = makeCompany(
      id,
      str(legacy?.settings.name) ||
        (id === "acme" ? "Acme Financial" : "Northstar Labs"),
      "Divyan Kavdia",
      "admin@example.test",
    );
    c.status = "Active";
    c.members = [];
    for (const role of roles.filter((r) => r !== "Neurofence operator")) {
      const name = users[role],
        existing = c.members.find((m) => m.name === name);
      if (existing) existing.roles.push(role);
      else
        c.members.push({
          id: `${id}-member-${c.members.length}`,
          version: 1,
          name,
          email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
          subject: `demo:${id}:${c.members.length}`,
          roles: [role],
          teams: [],
          status: "Active",
        });
    }
    for (const [name, role] of [
      ["Arjun Rao", "Security admin"],
      ["Platform reviewer", "Platform admin"],
    ] as const)
      c.members.push({
        id: `${id}-reviewer-${c.members.length}`,
        version: 1,
        name,
        email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
        subject: `demo:${id}:${c.members.length}`,
        roles: [role],
        teams: [],
        status: "Active",
      });
    for (const m of legacy?.data.members || []) {
      if (c.members.some((existing) => existing.name === m.name)) continue;
      if (!roles.includes(m.role as Role) || m.role === "Neurofence operator")
        continue;
      c.members.push({
        id: m.id,
        version: m.version,
        name: str(m.name),
        email: str(m.email),
        subject: `demo:${id}:${m.id}`,
        roles: [m.role as Role],
        teams: [],
        status: m.status === "Active" ? "Active" : "Invited",
      });
    }
    if (legacy)
      for (const key of Object.keys(companyDefaults))
        if (legacy.settings[key] !== undefined)
          c.config.values[key] = legacy.settings[key]!;
    c.history[0] = {
      ...structuredClone(c.config),
      version: 1,
      publishedAt: Date.now(),
      publishedBy: "Demo migration",
      reason: "Existing workspace defaults",
    };
    return c;
  });
  const directory: CompanyDirectory = {
    schema: 1,
    revision: 1,
    companies,
    receipts: {},
  };
  store.writeDirectory(directory);
  return directory;
}

export function resolveMembership(
  company: Company,
  session: Session,
): Membership {
  const member = company.members.find((m) =>
    session.subject ? m.subject === session.subject : m.name === session.user,
  );
  if (
    !member ||
    member.status !== "Active" ||
    !member.roles.includes(session.role)
  )
    throw new ApiError(
      403,
      "FORBIDDEN",
      "An active company membership with the selected role is required.",
    );
  return member;
}
export function authorizeCompany(company: Company, session: Session) {
  if (!company.environments.includes(session.environment))
    throw new ApiError(
      403,
      "ENVIRONMENT_DENIED",
      "This environment is not available to the company.",
    );
  if (session.role === "Neurofence operator") {
    if (session.user !== users["Neurofence operator"] || session.subject)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Use the explicit operator demo identity.",
      );
    return { ...session, permissions: templatePermissions(session.role) };
  }
  resolveMembership(company, session);
  if (company.status === "Suspended")
    throw new ApiError(
      403,
      "COMPANY_SUSPENDED",
      "This company is suspended. Contact your Neurofence operator.",
    );
  const permissions =
    company.config.rolePermissions[session.role] ||
    templatePermissions(session.role);
  return {
    ...session,
    permissions: permissions.filter((p) =>
      templatePermissions(session.role).includes(p),
    ),
  };
}
