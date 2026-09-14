import { moduleOptions } from "@neurofence/contracts/company";
import { Field } from "../../components/Fields";

export const sections: Record<string, Field[]> = {
  "Company profile": [
    { key: "name", label: "Company name", required: true },
    {
      key: "brandColor",
      label: "Brand color",
      help: "Six-digit hex, e.g. #193b2a",
      required: true,
    },
    { key: "timezone", label: "Company timezone", required: true },
    {
      key: "domains",
      label: "Approved email domains",
      type: "textarea",
      help: "One domain per line. Leave empty for unrestricted demo invitations.",
    },
    {
      key: "density",
      label: "Default display density",
      type: "select",
      options: ["Comfortable", "Compact"],
    },
    {
      key: "landingPage",
      label: "Default landing page",
      type: "select",
      options: [
        ["overview", "Command center"],
        ["inventory", "Inventory"],
        ["gateway", "AI gateway"],
        ["guardrails", "Guardrails"],
        ["agents", "Agents & MCP"],
        ["budgets", "FinOps"],
        ["governance", "Governance"],
        ["company", "Company administration"],
      ],
    },
  ],
  Modules: [
    {
      key: "modules",
      label: "Enabled company modules",
      type: "multi",
      options: moduleOptions.map(([id, name]) => [id, `${id} · ${name}`]),
      help: "Governance is required. Gateway requires Guardrails and FinOps; Agents also requires Gateway. Assurance requires Inventory.",
    },
  ],
  "Security & evidence": [
    {
      key: "residency",
      label: "Model residency rule",
      type: "select",
      options: ["India", "Any region"],
      help: "Restricts eligible model routes. Moving stored data needs a provisioning request.",
    },
    { key: "mandatoryPii", label: "Require PII inspection", type: "checkbox" },
    {
      key: "mandatoryInjection",
      label: "Require injection inspection",
      type: "checkbox",
    },
    {
      key: "fourEyes",
      label: "Require independent resource approval",
      type: "checkbox",
      help: "Company configuration always requires independent review.",
    },
    {
      key: "retention",
      label: "Evidence privacy",
      type: "select",
      options: ["Metadata only", "Redacted content", "Full content"],
    },
    {
      key: "days",
      label: "Evidence retention days",
      type: "number",
      min: 1,
      max: 3650,
    },
    {
      key: "rawContent",
      label: "Retain raw request content",
      type: "checkbox",
      help: "Requires Full content privacy. Legal holds continue to protect retained evidence.",
    },
  ],
  "Runtime & budgets": [
    {
      key: "maxTokens",
      label: "Maximum output tokens",
      type: "number",
      min: 1,
      max: 100000,
    },
    {
      key: "requestLimit",
      label: "Requests per application per minute",
      type: "number",
      min: 1,
    },
    {
      key: "monthlyBudget",
      label: "Monthly application ceiling (INR)",
      type: "number",
      min: 0,
      help: "Per application, per environment, UTC calendar month. Existing budget hierarchies also apply.",
    },
    {
      key: "allowedToolActions",
      label: "Allowed tool action classes",
      type: "multi",
      options: [
        "READ",
        "CREATE",
        "UPDATE",
        "DELETE",
        "FINANCIAL",
        "PRIVILEGED",
      ],
    },
    {
      key: "allowedProviders",
      label: "Allowed provider IDs",
      type: "textarea",
      help: "One ID per line. Empty permits all approved providers in the company workspace.",
    },
    {
      key: "allowedModels",
      label: "Allowed model deployment IDs",
      type: "textarea",
      help: "One deployment ID per line. Empty permits all approved model deployments.",
    },
  ],
  Notifications: [
    {
      key: "notifications",
      label: "Notification events",
      type: "multi",
      options: ["Budget alerts", "Security incidents", "Approval requests"],
    },
    {
      key: "notificationEmail",
      label: "Notification destination email",
      help: "Delivery remains simulated until an integration is provisioned.",
    },
  ],
  Identity: [
    {
      key: "identityMode",
      label: "Identity provider type",
      type: "select",
      options: ["Demo", "OIDC", "SAML"],
    },
    {
      key: "issuer",
      label: "Issuer / IdP URL",
      help: "HTTPS issuer from your identity provider.",
    },
    { key: "clientId", label: "Identity client ID" },
    {
      key: "secretRef",
      label: "Identity secret reference",
      help: "vault://, secret:// or an AWS Secrets Manager ARN. Never paste a password or token.",
    },
    {
      key: "sessionMinutes",
      label: "Session duration (minutes)",
      type: "number",
      min: 5,
      max: 1440,
    },
    {
      key: "groupMappings",
      label: "Identity group mappings",
      type: "textarea",
      help: "One group=Role per line, e.g. security-team=Security admin. Mapping is a production adapter configuration.",
    },
  ],
};
export const labels = Object.fromEntries(
  Object.values(sections)
    .flat()
    .map((field) => [field.key, field.label]),
);
export const lineFields = ["domains", "allowedProviders", "allowedModels"];
