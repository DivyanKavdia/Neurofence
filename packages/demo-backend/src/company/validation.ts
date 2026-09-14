import {
  Company,
  CompanyConfig,
  companyDefaults,
  overrideKeys,
  resolveCompanyConfig,
} from "@neurofence/contracts/company";
import {
  arr,
  Json,
  num,
  obj,
  Role,
  roles,
  str,
} from "@neurofence/contracts/types";
import { canonical, requireValue } from "../shared/values";
import { templatePermissions } from "./directory";

export function email(value: unknown) {
  requireValue(
    typeof value === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
      value.length <= 254,
    "Enter a valid email address.",
  );
}
export function textValue(value: unknown, label: string, max = 120) {
  requireValue(
    typeof value === "string" && value.trim().length > 0 && value.length <= max,
    `${label} is required (up to ${max} characters).`,
  );
}
function stringList(value: unknown, label: string, max = 100) {
  requireValue(
    Array.isArray(value) &&
      value.length <= max &&
      value.every(
        (v) => typeof v === "string" && v.length > 0 && v.length < 200,
      ) &&
      new Set(value).size === value.length,
    `${label} must be a unique list of strings.`,
  );
}
function validateValues(values: Record<string, Json>, company: Company) {
  requireValue(
    Object.keys(values).every((k) => Object.hasOwn(companyDefaults, k)),
    "Unknown company configuration key.",
  );
  for (const [key, value] of Object.entries(values)) {
    const kind = typeof companyDefaults[key];
    requireValue(
      Array.isArray(companyDefaults[key])
        ? Array.isArray(value)
        : typeof value === kind,
      `Invalid value type for ${key}.`,
    );
    if (typeof value === "string")
      requireValue(
        value.length <= (key === "logo" ? 250000 : 2000),
        `${key} is too long.`,
      );
  }
  textValue(values.name, "Company name");
  requireValue(
    /^#[0-9a-f]{6}$/i.test(str(values.brandColor)),
    "Choose a six-digit brand color.",
  );
  requireValue(
    !values.logo ||
      /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(
        str(values.logo),
      ),
    "Use a PNG, JPEG or WebP logo under 180 KB.",
  );
  try {
    new Intl.DateTimeFormat("en", { timeZone: str(values.timezone) });
  } catch {
    requireValue(false, "Enter a valid timezone, such as Asia/Kolkata.");
  }
  stringList(values.domains, "Approved domains");
  requireValue(
    arr<string>(values.domains).every(
      (d) =>
        /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(d) &&
        !d.includes(".."),
    ),
    "Enter domains without URLs or wildcards.",
  );
  stringList(values.modules, "Modules", 9);
  requireValue(
    arr(values.modules).includes("M9") &&
      arr<string>(values.modules).every((m) =>
        company.entitlements.includes(m),
      ),
    "Governance is required; modules must be included in company entitlements.",
  );
  for (const [module, dependencies] of Object.entries({
    M4: ["M3", "M6"],
    M5: ["M3", "M4", "M6"],
    M7: ["M1"],
    M8: ["M1"],
  }))
    if (arr(values.modules).includes(module))
      requireValue(
        dependencies.every((d) => arr(values.modules).includes(d)),
        `${module} requires ${dependencies.join(", ")}.`,
      );
  for (const [key, min, max] of [
    ["days", 1, 3650],
    ["maxTokens", 1, 100000],
    ["requestLimit", 1, 100000],
    ["sessionMinutes", 5, 1440],
  ] as const)
    requireValue(
      Number.isInteger(values[key]) &&
        num(values[key]) >= min &&
        num(values[key]) <= max,
      `${key} must be an integer between ${min} and ${max}.`,
    );
  requireValue(
    Number.isFinite(values.monthlyBudget) &&
      num(values.monthlyBudget) >= 0 &&
      num(values.monthlyBudget) <= 1e12,
    "Monthly application budget must be a non-negative number.",
  );
  const enums: Record<string, string[]> = {
    density: ["Comfortable", "Compact"],
    residency: ["India", "Any region"],
    retention: ["Metadata only", "Redacted content", "Full content"],
    identityMode: ["Demo", "OIDC", "SAML"],
    currency: ["INR"],
    landingPage: [
      "overview",
      "inventory",
      "gateway",
      "guardrails",
      "agents",
      "budgets",
      "governance",
      "company",
    ],
  };
  for (const [key, options] of Object.entries(enums))
    requireValue(
      options.includes(str(values[key])),
      `Choose a supported ${key}.`,
    );
  requireValue(
    values.retention !== "Metadata only" || !values.rawContent,
    "Metadata-only privacy cannot retain raw content.",
  );
  requireValue(
    values.retention !== "Redacted content" || !values.rawContent,
    "Raw retention requires Full content privacy.",
  );
  for (const key of [
    "allowedProviders",
    "allowedModels",
    "allowedToolActions",
    "notifications",
  ])
    stringList(values[key], key);
  requireValue(
    arr<string>(values.allowedToolActions).every((a) =>
      [
        "READ",
        "CREATE",
        "UPDATE",
        "DELETE",
        "FINANCIAL",
        "PRIVILEGED",
      ].includes(a),
    ),
    "Choose supported tool action classes.",
  );
  requireValue(
    arr<string>(values.notifications).every((a) =>
      ["Budget alerts", "Security incidents", "Approval requests"].includes(a),
    ),
    "Choose supported notification events.",
  );
  if (values.notificationEmail) email(values.notificationEmail);
  if (values.issuer)
    requireValue(
      /^https:\/\/[^\s]+$/.test(str(values.issuer)),
      "Identity issuer must use HTTPS.",
    );
  if (values.secretRef)
    requireValue(
      /^(vault:\/\/|arn:aws:secretsmanager:|secret:\/\/)[^\s]+$/.test(
        str(values.secretRef),
      ),
      "Use a secret reference; never paste a credential.",
    );
  if (values.identityMode !== "Demo")
    requireValue(
      values.issuer && values.clientId && values.secretRef,
      "Identity configuration needs issuer, client ID and secret reference. Authentication still requires the production adapter.",
    );
  const mappings = arr<Record<string, Json>>(values.groupMappings);
  requireValue(
    mappings.length <= 100 &&
      mappings.every(
        (m) =>
          m &&
          typeof m === "object" &&
          typeof m.group === "string" &&
          m.group.length > 0 &&
          roles.includes(m.role as Role) &&
          m.role !== "Neurofence operator",
      ),
    "Each identity group mapping needs a group and a company role.",
  );
  requireValue(
    new Set(mappings.map((m) => m.group)).size === mappings.length,
    "Identity groups must be unique.",
  );
}

export function validateConfig(config: CompanyConfig, company: Company) {
  requireValue(
    config && typeof config === "object",
    "Provide company configuration.",
  );
  requireValue(
    Object.keys(companyDefaults).every((k) => Object.hasOwn(config.values, k)),
    "Company defaults are incomplete.",
  );
  validateValues(config.values, company);
  stringList(config.locked, "Locked settings");
  requireValue(
    config.locked.every((k) => overrideKeys.includes(k)),
    "Only inheritable settings can be locked.",
  );
  requireValue(
    Array.isArray(config.overrides) && config.overrides.length <= 100,
    "A company can have up to 100 configuration overrides.",
  );
  const scopes = new Set<string>();
  const ids = new Set<string>();
  for (const override of config.overrides) {
    requireValue(
      override && ["team", "environment", "project"].includes(override.scope),
      "Choose a valid override scope.",
    );
    textValue(override.target, "Override target");
    textValue(override.id, "Override identifier");
    requireValue(!ids.has(override.id), "Override identifiers must be unique.");
    ids.add(override.id);
    const scope = `${override.scope}:${override.environment}:${override.target}`;
    requireValue(
      !scopes.has(scope),
      "Combine settings for the same override scope into one entry.",
    );
    scopes.add(scope);
    if (override.scope === "environment")
      requireValue(
        company.environments.includes(override.target),
        "Unknown override environment.",
      );
    if (override.scope === "team")
      requireValue(
        company.teams.some((t) => t.id === override.target),
        "Unknown override team.",
      );
    if (override.scope === "project")
      requireValue(
        company.environments.includes(override.environment),
        "Project overrides require an environment.",
      );
    requireValue(
      override.values &&
        typeof override.values === "object" &&
        !Array.isArray(override.values) &&
        Object.keys(override.values).every((k) => overrideKeys.includes(k)),
      "Override contains a company-only or unknown setting.",
    );
    for (const [key, value] of Object.entries(override.values)) {
      requireValue(
        !config.locked.includes(key) ||
          canonical(value) === canonical(config.values[key]),
        `${key} is locked at company level.`,
      );
      if (key === "modules")
        requireValue(
          arr<string>(value).every((m) =>
            arr(config.values.modules).includes(m),
          ),
          "Overrides cannot enable modules disabled by the company.",
        );
    }
    validateValues({ ...config.values, ...override.values }, company);
  }
  for (const environment of company.environments) {
    validateValues(
      resolveCompanyConfig(company, environment, "", config).values,
      company,
    );
    for (const p of company.projectTeams.filter(
      (p) => p.environment === environment,
    ))
      validateValues(
        resolveCompanyConfig(company, environment, p.project, config).values,
        company,
      );
  }
  requireValue(
    config.rolePermissions &&
      typeof config.rolePermissions === "object" &&
      !Array.isArray(config.rolePermissions),
    "Role permissions must be a map.",
  );
  for (const [role, permissions] of Object.entries(config.rolePermissions)) {
    requireValue(
      roles.includes(role as Role) &&
        !["Neurofence operator", "Company admin"].includes(role),
      "Company administration and operator roles cannot be overridden.",
    );
    stringList(permissions, "Role permissions");
    requireValue(
      permissions.every((p) => templatePermissions(role as Role).includes(p)),
      "Delegated permissions must stay within the role template.",
    );
  }
}

export function parseConfig(
  body: Record<string, Json>,
  company: Company,
): CompanyConfig {
  requireValue(
    Object.keys(body).every((k) =>
      ["values", "locked", "overrides", "rolePermissions", "reason"].includes(
        k,
      ),
    ),
    "Unknown configuration field.",
  );
  if (body.values !== undefined)
    requireValue(
      body.values &&
        typeof body.values === "object" &&
        !Array.isArray(body.values),
      "Configuration values must be an object.",
    );
  const current = company.draft || company.config;
  const config: CompanyConfig = {
    values: { ...current.values, ...obj(body.values) },
    locked:
      body.locked === undefined ? current.locked : (body.locked as string[]),
    overrides:
      body.overrides === undefined
        ? current.overrides
        : (body.overrides as CompanyConfig["overrides"]),
    rolePermissions:
      body.rolePermissions === undefined
        ? current.rolePermissions
        : (body.rolePermissions as CompanyConfig["rolePermissions"]),
  };
  validateConfig(config, company);
  return structuredClone(config);
}
