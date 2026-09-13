import React, { useState } from "react";
import { arr, can, Collection, Json, num, obj, Row, State, str } from "./types";
import {
  Badge,
  Button,
  Confirm,
  DataTable,
  Details,
  download,
  Field,
  FormDialog,
  Notice,
  Panel,
  resourceOptions,
  TraceView,
  useAction,
  useConsole,
} from "./ui";

export function fieldsFor(
  collection: Collection,
  state: State,
  user: string,
): Field[] {
  const name: Field = { key: "name", label: "Name", required: true },
    owner: Field = {
      key: "owner",
      label: "Owner",
      required: true,
      default: user,
    };
  const choice = (
    key: string,
    label: string,
    options: string[],
    value?: string,
  ): Field => ({
    key,
    label,
    type: "select",
    options,
    required: true,
    default: value || options[0],
  });
  const reference = (
    key: string,
    label: string,
    c: Collection,
    optional = false,
  ): Field => ({
    key,
    label,
    type: "select",
    options: resourceOptions(state, c),
    required: !optional,
    default: optional ? "" : state.data[c][0]?.id || "",
  });
  const count = (
    key: string,
    label: string,
    value: number,
    min = 1,
    max?: number,
  ): Field => ({
    key,
    label,
    type: "number",
    default: value,
    min,
    max,
    required: true,
  });
  const secret: Field = {
    key: "secret",
    label: "Secret reference",
    required: true,
    default: "vault://demo/connection",
    help: "Reference only. The demo never accepts or retrieves a provider secret.",
  };
  const schemas: Partial<Record<Collection, Field[]>> = {
    providers: [
      name,
      choice("type", "Native connector", [
        "Azure OpenAI",
        "OpenAI",
        "Anthropic",
        "AWS Bedrock",
        "Google Vertex AI",
        "Self-hosted",
      ]),
      choice("region", "Region", ["India Central", "India West", "Global"]),
      secret,
      { key: "endpoint", label: "Optional custom endpoint", default: "" },
    ],
    models: [
      name,
      reference("provider", "Provider", "providers"),
      choice("region", "Region", ["India Central", "India West", "Global"]),
      {
        key: "capabilities",
        label: "Capabilities",
        type: "multi",
        options: ["Chat", "Streaming", "Embeddings", "Responses", "Vision"],
        default: ["Chat"],
      },
      count("inputRate", "Input price per 1K tokens (INR)", 0.35, 0),
      count("outputRate", "Output price per 1K tokens (INR)", 0.9, 0),
    ],
    projects: [
      name,
      owner,
      reference("route", "Model route", "routes"),
      reference("policy", "Guardrail policy", "policies"),
      reference("budget", "Budget", "budgets"),
    ],
    routes: [
      name,
      {
        key: "alias",
        label: "Model alias",
        required: true,
        default: "governed-chat",
      },
      reference("primary", "Primary provider", "providers"),
      reference("fallback", "Fallback provider", "providers", true),
      count("threshold", "Use fallback below remaining budget (%)", 20, 0, 100),
      count("retries", "Maximum retries", 2, 0, 5),
      choice("region", "Residency constraint", ["India only", "Any region"]),
    ],
    policies: [
      name,
      choice("mode", "Enforcement mode", ["enforce", "monitor"]),
      choice("pii", "Sensitive input action", ["redact", "block", "monitor"]),
      choice("injection", "Prompt injection action", ["block", "monitor"]),
      choice("region", "Residency", ["India only", "Any region"]),
      {
        key: "response",
        label: "Inspect provider responses",
        type: "checkbox",
        default: true,
      },
      choice("responseAction", "Sensitive response action", [
        "redact",
        "block",
        "monitor",
      ]),
      choice("streaming", "Streaming mode", [
        "strict_buffered",
        "balanced_chunked",
        "posthoc_monitor",
      ]),
      count("maxTokens", "Maximum output tokens", 4096, 1, 32768),
      {
        key: "detectors",
        label: "Ordered detector pipeline",
        type: "ordered",
        options: resourceOptions(state, "detectors"),
        default: ["pii", "secrets", "injection"],
      },
    ],
    budgets: [
      name,
      reference("parent", "Parent budget", "budgets", true),
      count("limit", "Spend limit (INR)", 100, 0),
      {
        key: "hard",
        label: "Enforce as a hard limit",
        type: "checkbox",
        default: true,
      },
      choice("currency", "Ledger currency", ["INR"]),
      choice("period", "Budget period", ["Monthly", "Weekly", "Daily"]),
      count("threshold", "Alert threshold (%)", 80, 0, 100),
      choice("action", "Threshold action", [
        "Block",
        "Notify",
        "Throttle",
        "Route",
        "Require approval",
        "Circuit break",
      ]),
      reference("fallback", "Lower-cost provider", "providers", true),
      count("rpm", "Requests per minute", 120),
      count("tokens", "Tokens per minute", 100000),
      count("concurrency", "Concurrent requests", 10),
    ],
    agents: [
      name,
      owner,
      { key: "purpose", label: "Purpose", type: "textarea", required: true },
      reference("project", "Application", "projects"),
      choice("environment", "Environment", [
        "Development",
        "Staging",
        "Production",
      ]),
      {
        key: "dataScope",
        label: "Data scope",
        default: "Approved records",
        required: true,
      },
      {
        key: "allowedTools",
        label: "Requested tools",
        type: "multi",
        options: state.data.tools.map((t) => [t.id, `${t.name} · ${t.action}`]),
        default: [],
      },
      count("maxSteps", "Workflow call limit", 20),
      count("maxDuration", "Workflow duration (seconds)", 3600),
      count("maxDepth", "Maximum delegation depth", 3),
    ],
    servers: [
      name,
      owner,
      {
        key: "endpoint",
        label: "MCP endpoint",
        required: true,
        default: "https://mcp.example.test/mcp",
      },
      choice("transport", "Transport", [
        "Streamable HTTP",
        "SSE compatibility",
      ]),
      choice("auth", "Authentication", [
        "OAuth broker",
        "API key broker",
        "mTLS",
      ]),
      secret,
    ],
    tools: [
      name,
      reference("serverId", "MCP server", "servers"),
      choice("action", "Action class", [
        "READ",
        "CREATE",
        "UPDATE",
        "DELETE",
        "FINANCIAL",
        "PRIVILEGED",
      ]),
      {
        key: "scope",
        label: "Allowed resource or prefix",
        required: true,
        default: "RECORD-*",
      },
      {
        key: "parameters",
        label: "Required argument names",
        type: "multi",
        options: ["claim_id", "vendor_id", "account_ref", "record_id", "query"],
        default: ["record_id"],
      },
      {
        key: "expires",
        label: "Permission expires",
        type: "datetime",
        required: true,
        default: Date.now() + 7 * 86400000,
      },
    ],
    assets: [
      name,
      choice("type", "Asset type", [
        "Application",
        "Agent",
        "Model",
        "MCP server",
        "Tool",
        "Repository",
        "Extension",
      ]),
      owner,
      choice("risk", "Risk", ["Low", "Medium", "High", "Critical"]),
      choice("coverage", "Control coverage", [
        "Governed",
        "Partial",
        "Unprotected",
      ]),
      choice("status", "Lifecycle", [
        "Discovered",
        "Active",
        "Quarantined",
        "Archived",
      ]),
      {
        key: "tags",
        label: "Tags",
        type: "multi",
        options: ["production", "agent", "shadow-ai", "sensitive", "reviewed"],
        default: [],
      },
      {
        key: "links",
        label: "Related objects",
        type: "multi",
        options: [
          ...resourceOptions(state, "projects"),
          ...resourceOptions(state, "agents"),
          ...resourceOptions(state, "routes"),
          ...resourceOptions(state, "policies"),
          ...resourceOptions(state, "budgets"),
        ],
        default: [],
      },
    ],
    workforcePolicies: [
      name,
      choice("instance", "Account instance", [
        "Personal account",
        "Enterprise tenant",
        "Unknown account",
      ]),
      choice("activity", "Activity", [
        "Visit",
        "Prompt",
        "Paste",
        "File upload",
        "Download",
      ]),
      choice("action", "Action", ["Allow", "Coach", "Redact", "Block"]),
      {
        key: "justification",
        label: "Require user justification",
        type: "checkbox",
        default: true,
      },
    ],
    exceptions: [
      name,
      { key: "resource", label: "Resource or incident ID", required: true },
      { key: "scope", label: "Exact exception scope", required: true },
      {
        key: "reason",
        label: "Business justification",
        type: "textarea",
        required: true,
      },
      {
        key: "expires",
        label: "Exception expires",
        type: "datetime",
        required: true,
        default: Date.now() + 86400000,
      },
    ],
    campaigns: [
      name,
      reference("target", "Target application", "projects"),
      choice("pack", "Test pack", [
        "Prompt injection",
        "Data leakage",
        "Tool misuse",
        "Full regression",
      ]),
      choice("schedule", "Schedule", [
        "Manual",
        "Daily",
        "Weekly",
        "CI triggered",
      ]),
      choice("gate", "Release gate", [
        "Block on high severity",
        "Block on any finding",
      ]),
    ],
    scans: [
      name,
      reference("target", "Target application", "projects"),
      {
        key: "artifact",
        label: "Artifact reference",
        required: true,
        default: "registry.example.test/models/claims:v1",
      },
      choice("provenance", "Provenance input", [
        "Signed image",
        "Model manifest",
        "MCP package",
        "Repository revision",
      ]),
      choice("gate", "Release gate", [
        "Block on high severity",
        "Block on any finding",
      ]),
    ],
    integrations: [
      name,
      choice("type", "Integration type", [
        "SIEM webhook",
        "OpenTelemetry",
        "IdP / OIDC",
        "ITSM",
        "DLP connector",
        "Endpoint connector",
      ]),
      {
        key: "endpoint",
        label: "Endpoint",
        required: true,
        default: "https://connector.example.test/events",
      },
      secret,
    ],
    members: [
      name,
      { key: "email", label: "Email address", required: true },
      choice("role", "Role", [
        "Platform admin",
        "Security admin",
        "Governance owner",
        "Platform engineer",
        "Developer",
        "Agent owner",
        "FinOps owner",
        "SOC analyst",
        "Auditor",
      ]),
    ],
  };
  return schemas[collection] || [name];
}
export function Editor({
  collection,
  id,
}: {
  collection: Collection;
  id?: string;
}) {
  const ctx = useConsole(),
    record = ctx.state.data[collection].find((r) => r.id === id),
    config = ["policies", "routes", "budgets"].includes(collection);
  const fields = fieldsFor(collection, ctx.state, ctx.session.user),
    initial = record
      ? (Object.fromEntries(
          fields.map((f) => [
            f.key,
            obj(record.draft)[f.key] ?? record[f.key] ?? f.default ?? "",
          ]),
        ) as Record<string, Json>)
      : {};
  return (
    <FormDialog
      title={`${id ? "Edit" : "Create"} ${labels[collection] || collection}`}
      sub={
        config
          ? "Save a new draft, simulate the impact, obtain review and publish."
          : ""
      }
      fields={fields}
      initial={initial}
      submit={config ? "Save draft" : "Save"}
      onSubmit={async (body) => {
        const row = await ctx.mutate<Row>(
          `/api/v1/${collection}${id ? `/${id}${config ? "/draft" : ""}` : ""}`,
          body,
          record,
          id && !config ? "PATCH" : "POST",
        );
        ctx.open(<ResourceDetail collection={collection} id={row.id} />);
      }}
    />
  );
}
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
export function ResourceDetail({
  collection,
  id,
}: {
  collection: Collection;
  id: string;
}) {
  const ctx = useConsole(),
    act = useAction(),
    record = ctx.state.data[collection].find((r) => r.id === id),
    [credential, setCredential] = useState("");
  if (!record)
    return (
      <>
        <h2>Record unavailable</h2>
        <p>It may have been removed or moved outside your current scope.</p>
      </>
    );
  const row = record,
    config = ["policies", "routes", "budgets"].includes(collection),
    target = `/api/v1/${collection}/${id}`;
  const confirm = (action: string, verb: string) =>
    ctx.open(
      <Confirm
        title={`${verb} ${row.name}`}
        description="The change updates this demo record and its audit history."
        verb={verb}
        onConfirm={async (reason) => {
          await ctx.mutate(`${target}/${action}`, { reason }, row);
          ctx.close();
        }}
      />,
    );
  const issue = async (action: string) => {
    try {
      const result = await ctx.mutate<{ credential: string }>(
        `${target}/${action}`,
        {},
        row,
      );
      setCredential(result.credential || "");
    } catch {}
  };
  return (
    <>
      <div className="eyebrow">
        {labels[collection] || collection} · version {row.version}
      </div>
      <h2>{str(row.name || row.id)}</h2>
      <div className="row wrap">
        <Badge value={row.status} />
        {row.draftStatus && <Badge value={`Draft: ${row.draftStatus}`} />}
      </div>
      <Details
        row={row}
        fields={fieldsFor(collection, ctx.state, ctx.session.user)
          .map((f) => f.key)
          .filter(
            (k) =>
              ![
                "name",
                "secret",
                "links",
                "allowedTools",
                "detectors",
              ].includes(k),
          )}
      />
      {row.secret && (
        <Notice>
          Credential reference: <code>{str(row.secret)}</code>. Secret values
          are never returned.
        </Notice>
      )}
      {row.links && <RelationshipView row={row} />}
      {collection === "routes" && (
        <RouteCanvas row={{ ...row, ...obj(row.draft) }} />
      )}
      {collection === "agents" && (
        <>
          <Panel title="Delegation and authority">
            <p>
              {str(row.owner)} →{" "}
              {
                ctx.state.data.projects.find((p) => p.id === row.project)
                  ?.name as string
              }{" "}
              → {str(row.name)}
            </p>
            {arr<string>(row.allowedTools).map((id) => (
              <div className="row between" key={id}>
                <span>
                  {str(
                    ctx.state.data.tools.find((t) => t.id === id)?.name || id,
                  )}
                </span>
                <Badge
                  value={ctx.state.data.tools.find((t) => t.id === id)?.action}
                />
              </div>
            ))}
            {!arr(row.allowedTools).length && (
              <p>No tools are granted. Runtime calls will be denied.</p>
            )}
            <p>
              {num(row.stepsUsed)} of {num(row.maxSteps)} workflow calls used.
            </p>
          </Panel>
          <Button
            cap="run"
            onClick={() => ctx.go("agents", "Tool playground", id)}
          >
            Test agent
          </Button>
          <Button
            cap="agents"
            onClick={() => act(`${target}/workflow`, {}, row)}
          >
            Start new workflow
          </Button>
        </>
      )}
      {collection === "tools" && (
        <>
          <Panel title="Tool schema">
            <pre>
              {JSON.stringify(
                {
                  type: "object",
                  required: row.parameters,
                  additionalProperties: false,
                  properties: Object.fromEntries(
                    arr<string>(row.parameters).map((k) => [
                      k,
                      { type: "string" },
                    ]),
                  ),
                },
                null,
                2,
              )}
            </pre>
            <p>
              Resource: {str(row.scope)} · Expires{" "}
              {new Date(num(row.expires)).toLocaleString()}
            </p>
          </Panel>
          <Button cap="tools" onClick={() => act(`${target}/approve`, {}, row)}>
            Approve permission
          </Button>
        </>
      )}
      {collection === "providers" && (
        <>
          <div className="steps compact">
            <span>1. Connection</span>
            <span>2. Validate</span>
            <span>3. Discover & approve</span>
            <span>4. Publish</span>
          </div>
          <div className="row wrap">
            <Button
              cap="providers"
              onClick={() => act(`${target}/validate`, {}, row)}
            >
              Validate connection
            </Button>
            <Button
              cap="providers"
              disabled={!["Validated", "Healthy"].includes(str(row.status))}
              onClick={() => act(`${target}/discover`, {}, row)}
            >
              Discover models
            </Button>
            <Button
              cap="providers"
              disabled={
                !ctx.state.data.models.some(
                  (m) => m.provider === id && m.status === "Approved",
                )
              }
              onClick={() => act(`${target}/publish`, {}, row)}
            >
              Publish catalog
            </Button>
          </div>
          <DataTable
            name="Discovered models"
            rows={ctx.state.data.models.filter((m) => m.provider === id)}
            columns={[
              { key: "name", label: "Model" },
              { key: "region", label: "Region" },
              {
                key: "status",
                label: "Approval",
                render: (m) => <Badge value={m.status} />,
              },
              {
                key: "approve",
                label: "Action",
                render: (m) => (
                  <Button
                    cap="models"
                    disabled={m.status === "Approved"}
                    onClick={() => act(`/api/v1/models/${m.id}/approve`, {}, m)}
                  >
                    Approve model
                  </Button>
                ),
              },
            ]}
          />
        </>
      )}
      {collection === "models" && (
        <Button cap="models" onClick={() => act(`${target}/approve`, {}, row)}>
          Approve deployment
        </Button>
      )}
      {collection === "projects" && (
        <>
          <Panel title="Virtual credential">
            <p>
              Status: <Badge value={row.keyStatus} />
              {row.keySuffix && ` · ending ${row.keySuffix}`}
            </p>
            {credential && (
              <div className="response-box">
                <strong>Copy this demo key now</strong>
                <code>{credential}</code>
                <p>Base URL: https://gateway.example.test/v1</p>
                <Button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(credential)
                      .then(() => ctx.notify("Demo key copied."))
                      .catch(() => ctx.notify("Select and copy the key above."))
                  }
                >
                  Copy key
                </Button>
              </div>
            )}
            <div className="row wrap">
              <Button cap="projects" onClick={() => issue("issue")}>
                Issue key
              </Button>
              <Button cap="projects" onClick={() => issue("rotate")}>
                Rotate key
              </Button>
              <Button
                cap="projects"
                danger
                onClick={() => confirm("revoke", "Revoke credential")}
              >
                Revoke key
              </Button>
              <Button
                cap="run"
                onClick={() => ctx.go("gateway", "Playground", id)}
              >
                Test application
              </Button>
            </div>
          </Panel>
        </>
      )}
      {collection === "servers" && (
        <>
          <Button
            cap="servers"
            onClick={() => act(`${target}/discover`, {}, row)}
          >
            Discover capabilities
          </Button>
          <Details row={row} fields={["resources", "prompts", "provenance"]} />
          <DataTable
            name="Server tools"
            rows={ctx.state.data.tools.filter((t) => t.serverId === id)}
            columns={[
              { key: "name", label: "Tool" },
              { key: "action", label: "Action" },
              {
                key: "status",
                label: "Permission",
                render: (t) => <Badge value={t.status} />,
              },
            ]}
            onOpen={(t) =>
              ctx.open(<ResourceDetail collection="tools" id={t.id} />)
            }
          />
        </>
      )}
      {collection === "assets" && (
        <>
          <Button
            cap="assets"
            onClick={() => act(`${target}/snapshot`, {}, row)}
          >
            Create AI-BOM snapshot
          </Button>
          <Panel
            title={`AI-BOM v${num(row.bomVersion, 1)}`}
            sub="Snapshots preserve ownership, tags and related objects."
          >
            <div className="diff-grid">
              <div>
                <strong>Previous snapshot</strong>
                <pre>
                  {JSON.stringify(
                    arr(row.bomHistory).at(-1) || {
                      note: "No previous snapshot",
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div>
                <strong>Current</strong>
                <pre>
                  {JSON.stringify(
                    { owner: row.owner, tags: row.tags, links: row.links },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          </Panel>
          <Button
            cap="exceptions"
            onClick={() => ctx.open(<ExceptionForm resource={id} />)}
          >
            Request exception
          </Button>
        </>
      )}
      {config && (
        <>
          <Panel
            title="Version lifecycle"
            sub="Drafts require simulation and independent review before publication."
          >
            <div className="row wrap">
              <Button
                cap={collection}
                disabled={!row.draft}
                onClick={() => act(`${target}/simulate`, {}, row)}
              >
                Simulate draft
              </Button>
              <Button
                cap={collection}
                disabled={row.draftStatus !== "Simulated"}
                onClick={() => act(`${target}/submit`, {}, row)}
              >
                Request review
              </Button>
              <Button
                cap={collection}
                disabled={
                  row.draftStatus !== "Approved" || !num(row.publishedVersion)
                }
                title={
                  !num(row.publishedVersion)
                    ? "Publish an initial version first"
                    : "Apply the draft to 10% of requests"
                }
                onClick={() => act(`${target}/canary`, {}, row)}
              >
                Publish 10% canary
              </Button>
              <Button
                cap={collection}
                disabled={row.draftStatus !== "Approved"}
                onClick={() => act(`${target}/publish`, {}, row)}
              >
                Publish to all
              </Button>
              <Button
                cap={collection}
                disabled={row.status !== "Canary"}
                onClick={() => act(`${target}/promote`, {}, row)}
              >
                Promote canary
              </Button>
              <Button
                cap={collection}
                disabled={!arr(row.history).length}
                onClick={() => confirm("rollback", "Roll back")}
              >
                Roll back
              </Button>
            </div>
            {row.simulation && (
              <Notice>
                Simulation {str(obj(row.simulation).status)} ·{" "}
                {num(obj(row.simulation).affected)} directly bound applications
                affected.
              </Notice>
            )}
            <div className="diff-grid">
              <div>
                <h3>Published configuration</h3>
                <pre>
                  {JSON.stringify(
                    Object.fromEntries(
                      fieldsFor(collection, ctx.state, ctx.session.user).map(
                        (f) => [f.key, row[f.key]],
                      ),
                    ),
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div>
                <h3>Draft changes</h3>
                <pre>
                  {JSON.stringify(
                    row.draft || { note: "No unpublished changes" },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
            {arr(row.history).length > 0 && (
              <details>
                <summary>
                  {arr(row.history).length} immutable version snapshots
                </summary>
                <pre>{JSON.stringify(row.history, null, 2)}</pre>
              </details>
            )}
          </Panel>
        </>
      )}
      {["campaigns", "scans"].includes(collection) && (
        <>
          <Notice>
            Assurance results use synthetic fixtures. Remediation and retest
            exercise the release workflow.
          </Notice>
          <div className="row wrap">
            <Button
              cap={collection}
              disabled={row.status === "Running"}
              onClick={() => act(`${target}/run`, {}, row)}
            >
              Run {collection === "scans" ? "scan" : "campaign"}
            </Button>
            <Button
              cap={collection}
              disabled={!row.remediation || row.status === "Running"}
              onClick={() => act(`${target}/retest`, {}, row)}
            >
              Retest
            </Button>
            <Button
              cap={collection}
              disabled={row.status !== "Passed"}
              onClick={() => act(`${target}/gate`, {}, row)}
            >
              Release gate
            </Button>
            <Button
              cap={collection}
              onClick={() => confirm("remediate", "Link remediation")}
            >
              Link remediation
            </Button>
          </div>
          {row.status === "Running" && (
            <div role="status">
              <progress
                max="100"
                value={num(
                  ctx.state.data.jobs.find(
                    (j) => j.resource === id && j.status === "Running",
                  )?.progress,
                )}
              />
              Running sample checks…
            </div>
          )}
          <pre>{JSON.stringify(row.findings || [], null, 2)}</pre>
          <Details row={row} fields={["gate", "remediation", "runHistory"]} />
        </>
      )}
      {collection === "integrations" && (
        <>
          <Button
            cap="integrations"
            onClick={() => act(`${target}/test`, {}, row)}
          >
            Test connection
          </Button>
          <p>{str(row.message)}</p>
        </>
      )}
      <div className="dialog-actions wrap">
        <Button
          cap={collection}
          onClick={() => ctx.open(<Editor collection={collection} id={id} />)}
        >
          {config ? "Edit draft" : "Edit"}
        </Button>
        {["providers", "projects", "agents"].includes(collection) && (
          <Button
            cap={collection}
            onClick={() =>
              act(
                `${target}/status`,
                {
                  status: ["Active", "Healthy"].includes(str(row.status))
                    ? "Paused"
                    : collection === "providers"
                      ? "Healthy"
                      : "Active",
                },
                row,
              )
            }
          >
            {["Active", "Healthy"].includes(str(row.status))
              ? "Pause"
              : "Resume"}
          </Button>
        )}
        {["members", "integrations"].includes(collection) && (
          <Button
            cap={collection}
            danger
            onClick={() =>
              ctx.open(
                <Confirm
                  title={`Remove ${row.name}`}
                  description="Remove this demo record. No external account is changed."
                  onConfirm={async (reason) => {
                    await ctx.mutate(target, { reason }, row, "DELETE");
                    ctx.close();
                  }}
                />,
              )
            }
          >
            Remove
          </Button>
        )}
        <Button
          onClick={() =>
            download(`${collection}-evidence.json`, {
              prototype: true,
              record: row,
              events: ctx.state.data.audit.filter((e) => e.reference === id),
            })
          }
        >
          Export record
        </Button>
      </div>
    </>
  );
}
export function Catalog({
  collection,
  title,
  sub,
  columns,
}: {
  collection: Collection;
  title: string;
  sub: string;
  columns?: string[];
}) {
  const ctx = useConsole(),
    keys = columns || ["name", "status", "owner"];
  return (
    <Panel
      title={title}
      sub={sub}
      actions={
        <Button
          cap={collection}
          primary
          onClick={() => ctx.open(<Editor collection={collection} />)}
        >
          Add {labels[collection] || "record"}
        </Button>
      }
    >
      <DataTable
        name={title}
        rows={ctx.state.data[collection]}
        columns={keys.map((key) => ({
          key,
          label: key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s) => s.toUpperCase()),
          render:
            key === "status" ? (r) => <Badge value={r.status} /> : undefined,
        }))}
        onOpen={(r) =>
          ctx.open(<ResourceDetail collection={collection} id={r.id} />)
        }
      />
    </Panel>
  );
}
export function ExceptionForm({ resource }: { resource: string }) {
  const ctx = useConsole();
  return (
    <FormDialog
      title="Request a scoped exception"
      fields={fieldsFor("exceptions", ctx.state, ctx.session.user)}
      initial={{ resource, name: "Temporary exception" }}
      submit="Request review"
      onSubmit={async (body) => {
        await ctx.mutate("/api/v1/exceptions", body);
        ctx.close();
        ctx.notify("Exception sent to the demo approval queue.");
      }}
    />
  );
}
export function RouteCanvas({ row }: { row: Row }) {
  const { state } = useConsole();
  const label = (id: unknown) =>
    str(state.data.providers.find((p) => p.id === id)?.name || "Not selected");
  return (
    <div className="route-canvas" aria-label="Route conditions and fallback">
      <div className="route-entry">
        <strong>{str(row.alias || row.name)}</strong>
        <span>Identity · guardrails · parent budgets</span>
      </div>
      <div className="route-branches">
        <div>
          <span className="eyebrow">Primary · when eligible</span>
          <strong>{label(row.primary)}</strong>
          <small>{str(row.region || "India only")}</small>
        </div>
        <div>
          <span className="eyebrow">Fallback · health or budget</span>
          <strong>{label(row.fallback)}</strong>
          <small>
            Below {num(row.threshold)}% remaining · {num(row.retries)} retry
            limit
          </small>
        </div>
      </div>
      <div className="route-exit">
        No eligible route → block and record evidence
      </div>
    </div>
  );
}
export function RelationshipView({ row }: { row: Row }) {
  const ctx = useConsole(),
    all = [
      "assets",
      "projects",
      "agents",
      "routes",
      "policies",
      "budgets",
      "tools",
    ] as Collection[],
    links = arr<string>(row.links);
  return (
    <Panel
      title="Related objects"
      sub="Select a relationship to inspect the connected configuration."
    >
      <div className="relationship">
        <div className="relationship-center">{str(row.name)}</div>
        <div className="relationship-items">
          {links.map((id) => {
            const c = all.find((c) =>
                ctx.state.data[c].some((r) => r.id === id),
              ),
              item = c ? ctx.state.data[c].find((r) => r.id === id) : null;
            return (
              <Button
                key={id}
                onClick={() =>
                  c && ctx.open(<ResourceDetail collection={c} id={id} />)
                }
              >
                {str(item?.name || id)} →
              </Button>
            );
          })}
          {!links.length && <p>No relationships are recorded yet.</p>}
        </div>
      </div>
    </Panel>
  );
}
