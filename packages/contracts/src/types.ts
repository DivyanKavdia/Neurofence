export type Json =
  string | number | boolean | null | Json[] | { [key: string]: Json };

/** Versioned JSON resources. Every mutation is validated by the mock BFF schema. */
export type Row = {
  id: string;
  version: number;
  [key: string]: Json | undefined;
};

export const collections = [
  "providers",
  "models",
  "projects",
  "routes",
  "policies",
  "budgets",
  "agents",
  "servers",
  "tools",
  "assets",
  "traces",
  "approvals",
  "incidents",
  "audit",
  "workforce",
  "workforcePolicies",
  "exceptions",
  "campaigns",
  "scans",
  "integrations",
  "members",
  "detectors",
  "savedViews",
  "jobs",
  "prices",
  "controls",
  "distributions",
] as const;

export type Collection = (typeof collections)[number];

export type Role =
  | "Platform admin"
  | "Security admin"
  | "Governance owner"
  | "Platform engineer"
  | "Developer"
  | "Agent owner"
  | "FinOps owner"
  | "SOC analyst"
  | "Auditor";

export type Session = {
  tenant: string;
  environment: string;
  region: string;
  role: Role;
  user: string;
};

export type State = {
  schema: 2;
  revision: number;
  data: Record<Collection, Row[]>;
  settings: Row;
  gatewayReceipts?: Record<
    string,
    { payloadHash: string; trace: string; status: "pending" | "complete" }
  >;
};

export type Request = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, Json>;
  version?: number;
  idempotencyKey?: string;
};

export type Result<T = unknown> = {
  data: T;
  meta: { correlationId: string; revision: number; nextCursor?: string };
};

export type Transport = {
  request<T = unknown>(request: Request): Promise<Result<T>>;
  session: Session;
  setSession(session: Session): void;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable = false,
    public correlationId: string = crypto.randomUUID(),
  ) {
    super(message);
  }
}

export const str = (value: unknown) =>
  typeof value === "string" ? value : value == null ? "" : String(value);

export const num = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export const arr = <T = Json>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export const obj = (value: unknown): Record<string, Json> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {};

export const uid = (prefix = "id") => `${prefix}-${crypto.randomUUID()}`;

export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export const roles: Role[] = [
  "Platform admin",
  "Security admin",
  "Governance owner",
  "Platform engineer",
  "Developer",
  "Agent owner",
  "FinOps owner",
  "SOC analyst",
  "Auditor",
];

export const users: Record<Role, string> = {
  "Platform admin": "Divyan Kavdia",
  "Security admin": "Mira Kapoor",
  "Governance owner": "Ishaan Patel",
  "Platform engineer": "Rahul Mehta",
  Developer: "Priya Shah",
  "Agent owner": "Priya Shah",
  "FinOps owner": "Ananya Rao",
  "SOC analyst": "Neha Singh",
  Auditor: "Audit reviewer",
};

export const initialSession: Session = {
  tenant: "acme",
  environment: "Development",
  region: "India",
  role: "Platform admin",
  user: users["Platform admin"],
};

export const moduleMap: Record<string, string> = {
  overview: "M1",
  inventory: "M1",
  workforce: "M2",
  gateway: "M4",
  guardrails: "M3",
  agents: "M5",
  budgets: "M6",
  incidents: "M9",
  assurance: "M7",
  governance: "M9",
};

export const capabilities: Record<string, Role[]> = {
  providers: ["Platform admin", "Platform engineer"],
  projects: ["Platform admin", "Platform engineer", "Developer"],
  routes: ["Platform admin", "Platform engineer"],
  policies: ["Security admin"],
  budgets: ["Platform admin", "FinOps owner"],
  agents: ["Platform admin", "Developer", "Agent owner"],
  servers: ["Platform admin", "Platform engineer"],
  tools: ["Security admin"],
  assets: ["Security admin", "Governance owner"],
  incidents: ["Security admin", "SOC analyst"],
  workforce: ["Security admin", "SOC analyst"],
  workforcePolicies: ["Security admin"],
  exceptions: [
    "Security admin",
    "Governance owner",
    "SOC analyst",
    "Developer",
    "Agent owner",
  ],
  campaigns: ["Security admin", "Developer"],
  scans: ["Security admin", "Developer"],
  integrations: ["Platform admin"],
  members: ["Platform admin"],
  detectors: ["Security admin"],
  settings: ["Platform admin"],
  approval: ["Security admin"],
  run: [
    "Platform admin",
    "Platform engineer",
    "Security admin",
    "Developer",
    "Agent owner",
  ],
  reveal: ["Security admin", "SOC analyst"],
  savedViews: roles,
  evidenceExport: ["Security admin", "Governance owner", "Auditor"],
  evidence: ["Security admin", "Governance owner"],
  distribution: ["Platform admin", "Platform engineer"],
  prices: [],
  controls: [],
  distributions: [],
  audit: [],
  models: ["Platform admin", "Platform engineer"],
};

export const can = (session: Session, capability: string) =>
  (capabilities[capability] || []).includes(session.role);
