import { Collection } from "@neurofence/contracts/types";

export const labels: Partial<Record<Collection, string>> = {
  providers: "provider",
  models: "model deployment",
  projects: "application",
  routes: "route",
  policies: "guardrail policy",
  budgets: "budget",
  agents: "agent",
  servers: "MCP server",
  tools: "tool permission",
  assets: "asset",
  exceptions: "exception",
  campaigns: "campaign",
  scans: "supply-chain scan",
  integrations: "integration",
  members: "member",
  workforcePolicies: "workforce policy",
};
