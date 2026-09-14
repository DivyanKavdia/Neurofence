import { Company, Membership } from "@neurofence/contracts/company";
import {
  ApiError,
  arr,
  Role,
  roles,
  str,
  uid,
} from "@neurofence/contracts/types";
import { requireValue } from "../shared/values";
import { email, textValue, validateConfig } from "./validation";

import { CompanyCommand } from "./transaction";

export function handleCompanyPeople(ctx: CompanyCommand) {
  const { company, session, id, action, method, body, actor, saveCompany } =
    ctx;
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
      return saveCompany(
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
    return saveCompany(
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
    return saveCompany(
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
    return saveCompany(
      company,
      "Project team assigned",
      `${project.name} → ${body.team || "No team"}`,
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
