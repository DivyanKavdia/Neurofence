import { useState } from "react";
import { arr, Collection, num, obj, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { useAction } from "../../app/useAction";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Confirm } from "../../components/dialogs";
import { Badge, Notice } from "../../components/feedback";
import { Details, Panel } from "../../components/layout";
import { download } from "../../lib/files";
import { Editor } from "./Editor";
import { ExceptionForm } from "./ExceptionForm";
import { fieldsFor } from "./fields";
import { labels } from "./labels";
import { RelationshipView } from "./RelationshipView";
import { RouteCanvas } from "./RouteCanvas";

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
