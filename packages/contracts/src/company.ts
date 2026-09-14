import type { Json, Role, Row } from "./types";

export type Membership = Row & {
  name: string;
  email: string;
  subject: string;
  roles: Role[];
  teams: string[];
  status: "Invited" | "Active" | "Suspended";
};
export type CompanyTeam = Row & {
  name: string;
  department: string;
  costCenter: string;
};
export type ConfigOverride = {
  id: string;
  scope: "team" | "environment" | "project";
  target: string;
  environment: string;
  values: Record<string, Json>;
};
export type CompanyConfig = {
  values: Record<string, Json>;
  locked: string[];
  overrides: ConfigOverride[];
  /** Delegation can narrow the capabilities of built-in role templates. */
  rolePermissions: Partial<Record<Role, string[]>>;
};
export type ConfigDraft = CompanyConfig & {
  status: "Draft" | "Validated" | "Pending" | "Approved";
  createdBy: string;
  approvedBy?: string;
  reason: string;
  baseVersion: number;
  validatedAt?: number;
};
export type ConfigHistory = CompanyConfig & {
  version: number;
  publishedAt: number;
  publishedBy: string;
  reason: string;
};
export type Company = {
  id: string;
  version: number;
  name: string;
  status: "Onboarding" | "Active" | "Suspended";
  environments: string[];
  entitlements: string[];
  members: Membership[];
  teams: CompanyTeam[];
  projectTeams: { environment: string; project: string; team: string }[];
  config: CompanyConfig;
  publishedVersion: number;
  draft: ConfigDraft | null;
  history: ConfigHistory[];
  audit: Row[];
  provisioning: Row[];
  createdAt: number;
};
export type CompanyDirectory = {
  schema: 1;
  revision: number;
  companies: Company[];
  receipts: Record<string, { payload: string; data: Json }>;
};
export type CompanySummary = Pick<
  Company,
  "id" | "name" | "status" | "version" | "environments" | "entitlements"
>;
export type EffectiveConfig = {
  values: Record<string, Json>;
  sources: Record<string, string>;
  locked: string[];
  version: number;
};
export type CompanyWorkspace = {
  summary: CompanySummary;
  /** Exposed only to company admins, reviewers and auditors. */
  administration?: Company;
  effective: EffectiveConfig;
  permissions: string[];
  identities: { id: string; name: string; roles: Role[] }[];
  companies: CompanySummary[];
};

export const moduleOptions: [string, string][] = [
  ["M1", "Inventory"],
  ["M2", "Workforce AI"],
  ["M3", "Guardrails"],
  ["M4", "AI gateway"],
  ["M5", "Agents & MCP"],
  ["M6", "FinOps"],
  ["M7", "Red team"],
  ["M8", "Supply chain"],
  ["M9", "Governance"],
];
export const companyDefaults: Record<string, Json> = {
  name: "New company",
  brandColor: "#193b2a",
  logo: "",
  timezone: "Asia/Kolkata",
  domains: [],
  density: "Comfortable",
  landingPage: "overview",
  modules: moduleOptions.map(([id]) => id),
  residency: "India",
  retention: "Metadata only",
  days: 90,
  rawContent: false,
  fourEyes: true,
  maxTokens: 4000,
  mandatoryPii: false,
  mandatoryInjection: false,
  allowedProviders: [],
  allowedModels: [],
  allowedToolActions: [
    "READ",
    "CREATE",
    "UPDATE",
    "DELETE",
    "FINANCIAL",
    "PRIVILEGED",
  ],
  requestLimit: 120,
  monthlyBudget: 100000,
  currency: "INR",
  notifications: ["Budget alerts", "Security incidents", "Approval requests"],
  notificationEmail: "",
  identityMode: "Demo",
  issuer: "",
  clientId: "",
  secretRef: "",
  groupMappings: [],
  sessionMinutes: 60,
};
export const overrideKeys = [
  "density",
  "landingPage",
  "modules",
  "residency",
  "retention",
  "days",
  "rawContent",
  "fourEyes",
  "maxTokens",
  "mandatoryPii",
  "mandatoryInjection",
  "allowedProviders",
  "allowedModels",
  "allowedToolActions",
  "requestLimit",
  "monthlyBudget",
  "notifications",
];

/** Deterministic precedence: company → team → environment → project. Locks always win. */
export function resolveCompanyConfig(
  company: Company,
  environment: string,
  project = "",
  config = company.config,
): EffectiveConfig {
  const values = structuredClone(config.values);
  const sources = Object.fromEntries(
    Object.keys(values).map((key) => [key, "Company default"]),
  );
  const team = company.projectTeams.find(
    (p) => p.environment === environment && p.project === project,
  )?.team;
  for (const scope of ["team", "environment", "project"] as const) {
    for (const override of config.overrides) {
      if (override.scope !== scope) continue;
      const matches =
        scope === "team"
          ? override.target === team
          : scope === "environment"
            ? override.target === environment
            : !!project &&
              override.target === project &&
              override.environment === environment;
      if (!matches) continue;
      for (const [key, value] of Object.entries(override.values)) {
        if (config.locked.includes(key)) continue;
        values[key] = structuredClone(value);
        sources[key] =
          `${scope === "team" ? "Team" : scope === "environment" ? "Environment" : "Project"}: ${override.target}`;
      }
    }
  }
  return {
    values,
    sources,
    locked: config.locked,
    version: company.publishedVersion,
  };
}
