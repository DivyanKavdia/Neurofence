import {
  ApiError,
  arr,
  Collection,
  Json,
  num,
  Role,
  roles,
  Session,
  State,
  str,
} from "@neurofence/contracts/types";
import { requireValue } from "../shared/values";
import { fields, ownRoles } from "./schema";

export function validate(
  collection: Collection,
  body: Record<string, Json>,
  state: State,
  session: Session,
  id?: string,
) {
  const allowed = fields[collection] || [];
  requireValue(
    Object.keys(body).every((k) => allowed.includes(k)),
    `Unknown ${collection} field.`,
  );
  requireValue(
    str(body.name).trim().length >= 2,
    "Name must contain at least two characters.",
  );
  if (
    ownRoles.includes(session.role) &&
    ["projects", "agents"].includes(collection)
  )
    requireValue(
      body.owner === session.user,
      "Choose your own identity as owner.",
    );
  const reference = (field: string, target: Collection, optional = false) => {
    const value = str(body[field]);
    if (optional && !value) return;
    const r = state.data[target].find((r) => r.id === value);
    requireValue(r, `Select an existing ${field}.`);
    if (ownRoles.includes(session.role) && target === "projects")
      requireValue(
        r?.owner === session.user,
        "The application belongs to another owner.",
      );
  };
  if (collection === "projects") {
    reference("route", "routes");
    reference("policy", "policies");
    reference("budget", "budgets");
    requireValue(str(body.owner).trim(), "An owner is required.");
  }
  if (collection === "routes") {
    reference("primary", "providers");
    reference("fallback", "providers", true);
    requireValue(
      /^[a-z0-9][a-z0-9-]*$/.test(str(body.alias)),
      "Use a lowercase model alias with letters, numbers and hyphens.",
    );
    requireValue(
      num(body.threshold) >= 0 && num(body.threshold) <= 100,
      "Threshold must be 0–100.",
    );
    requireValue(
      num(body.retries) >= 0 && num(body.retries) <= 5,
      "Retry count must be 0–5.",
    );
  }
  if (collection === "budgets") {
    reference("parent", "budgets", true);
    let parent = str(body.parent),
      seen = new Set<string>();
    while (parent) {
      requireValue(
        parent !== id && !seen.has(parent),
        "Budget inheritance cannot contain a cycle.",
      );
      seen.add(parent);
      parent = str(state.data.budgets.find((b) => b.id === parent)?.parent);
    }
    requireValue(num(body.limit, -1) >= 0, "Budget cannot be negative.");
    requireValue(
      body.currency === "INR",
      "The demo ledger is denominated in INR.",
    );
    for (const f of ["rpm", "tokens", "concurrency"])
      requireValue(num(body[f]) >= 1, `${f} must be positive.`);
  }
  if (collection === "policies") {
    requireValue(
      num(body.maxTokens) >= 1 && num(body.maxTokens) <= 32768,
      "Output tokens must be 1–32768.",
    );
    requireValue(
      ["redact", "block", "monitor"].includes(str(body.pii)),
      "Choose a valid sensitive-data action.",
    );
    requireValue(
      arr(body.detectors).every((id) =>
        state.data.detectors.some((d) => d.id === id),
      ),
      "Select known detectors.",
    );
  }
  if (collection === "agents") {
    reference("project", "projects");
    requireValue(
      str(body.purpose).trim().length >= 5,
      "Declare the agent purpose.",
    );
    requireValue(
      num(body.maxSteps) >= 1 &&
        num(body.maxDuration) >= 1 &&
        num(body.maxDepth) >= 1,
      "Workflow limits must be positive.",
    );
    requireValue(
      arr(body.allowedTools).every((id) =>
        state.data.tools.some((t) => t.id === id),
      ),
      "Select registered tools.",
    );
  }
  if (["servers", "integrations"].includes(collection)) {
    try {
      const url = new URL(str(body.endpoint));
      requireValue(
        url.protocol === "https:" || url.hostname === "localhost",
        "Use HTTPS for non-local endpoints.",
      );
      requireValue(
        !url.username && !url.password,
        "Use a secret reference instead of credentials in the URL.",
      );
    } catch {
      throw new ApiError(422, "VALIDATION", "Enter a valid HTTPS endpoint.");
    }
  }
  if (["servers", "providers", "integrations"].includes(collection))
    requireValue(
      /^vault:\/\/|^arn:aws:secretsmanager:/.test(str(body.secret)),
      "Enter a Vault or Secrets Manager reference; do not enter a secret value.",
    );
  if (collection === "tools") {
    reference("serverId", "servers");
    requireValue(
      [
        "READ",
        "CREATE",
        "UPDATE",
        "DELETE",
        "FINANCIAL",
        "PRIVILEGED",
      ].includes(str(body.action)),
      "Choose an action classification.",
    );
    requireValue(
      num(body.expires) > Date.now(),
      "Permission expiry must be in the future.",
    );
  }
  if (collection === "exceptions") {
    requireValue(
      str(body.reason).trim().length >= 5,
      "Explain the exception request.",
    );
    requireValue(
      num(body.expires) > Date.now(),
      "Exception expiry must be in the future.",
    );
  }
  if (collection === "members") {
    requireValue(
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str(body.email)),
      "Enter a valid email address.",
    );
    requireValue(roles.includes(body.role as Role), "Choose a known role.");
    requireValue(
      !state.data.members.some(
        (m) =>
          m.id !== id &&
          str(m.email).toLowerCase() === str(body.email).toLowerCase(),
      ),
      "This email already exists.",
    );
  }
  if (["campaigns", "scans"].includes(collection)) {
    reference("target", "projects");
  }
}
