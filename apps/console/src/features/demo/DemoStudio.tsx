import { useEffect, useRef, useState } from "react";
import {
  DemoBackup,
  demoRequest,
  demoScenarios,
  ScenarioId,
} from "@neurofence/contracts/demo";
import { can, Json, Row } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { FormDialog } from "../../components/dialogs";
import { Empty, Notice } from "../../components/feedback";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/layout";
import { TraceView } from "../traces/TraceView";
import { download } from "../../lib/files";
import { date } from "../../lib/format";

type Preview = {
  digest: string;
  environment: string;
  template: string;
  scenario: string;
  records: number;
  suites: number;
  companyConfigChanged: boolean;
  createdAt: number;
};

export function DemoStudio() {
  const ctx = useConsole(),
    current = ctx.state.demoWorkspace;
  const fileRead = useRef(0);
  useEffect(
    () => () => {
      fileRead.current++;
    },
    [],
  );
  const [scenario, setScenario] = useState<ScenarioId>("baseline"),
    [template, setTemplate] = useState("Financial services");
  const [seed, setSeed] = useState(42),
    [samples, setSamples] = useState(12),
    [confirmed, setConfirmed] = useState(false);
  const [backup, setBackup] = useState<DemoBackup | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [fileName, setFileName] = useState("");
  const [error, setError] = useState(""),
    [trace, setTrace] = useState<Row | null>(null);
  const companyRow = {
    id: ctx.session.tenant,
    version: ctx.state.company?.summary.version || 0,
  };
  const launch = async (path: string, body: Record<string, Json>) => {
    setError("");
    try {
      const result = await ctx.mutate<{ environment: string }>(
        path,
        body,
        companyRow,
      );
      ctx.setSession({ ...ctx.session, environment: result.environment });
      ctx.go("demo", "Scenarios");
      ctx.notify("Demo environment ready");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  if (!can(ctx.session, "company"))
    return (
      <Empty
        title="Demo studio is managed by your company admin"
        text="Use Company admin preview to create or restore synthetic demo environments."
      />
    );
  if (ctx.state.settings.modelRuntime !== "mock")
    return (
      <Empty
        title="Demo studio needs the dummy backend"
        text="Use a separate mock workspace for scenarios. Live execution records stay in their original environment."
      />
    );
  return (
    <div className="stack">
      {current && (
        <section className="demo-current" aria-label="Current demo scenario">
          <div>
            <span className="eyebrow">
              Current demo · {ctx.session.environment}
            </span>
            <h2>
              {demoScenarios.find((s) => s.id === current.scenario)?.name}
            </h2>
            <p>
              {current.template} · Seed {current.seed} · {current.samples}{" "}
              generated requests
            </p>
          </div>
          <div className="row wrap">
            <Button
              primary
              onClick={async () => {
                setError("");
                try {
                  const request = demoRequest(current.scenario);
                  setTrace(await ctx.mutate<Row>(request.path, request.body));
                  ctx.notify("Scenario request completed");
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              Run scenario request
            </Button>
            <Button onClick={() => ctx.go("guardrails", "Test lab")}>
              Open policy tests
            </Button>
            <Button
              onClick={() =>
                ctx.open(
                  <FormDialog
                    title="Reset this demo"
                    sub={`Recreate ${ctx.session.environment} from its original scenario and seed. This replaces its edits, activity and test suites.`}
                    fields={[
                      {
                        key: "environment",
                        label: "Confirm environment name",
                        required: true,
                      },
                      {
                        key: "reason",
                        label: "Reason",
                        type: "textarea",
                        required: true,
                      },
                    ]}
                    submit="Reset demo environment"
                    onSubmit={async (body) => {
                      await ctx.mutate("/api/v1/demo/reset", body, {
                        id: ctx.session.environment,
                        version: ctx.state.revision,
                      });
                      setTrace(null);
                      ctx.close();
                      ctx.notify("Demo reset to its starting scenario");
                    }}
                  />,
                )
              }
            >
              Reset this demo
            </Button>
          </div>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {ctx.tab === "Backup & restore" ? (
        <div className="cols equal">
          <Panel
            title="Save a demo snapshot"
            sub="Download this demo's resource configuration, sample activity and saved policy inputs."
          >
            <p>
              Snapshots belong to this company. They exclude membership, company
              settings, audit history, credentials and executable approvals.
            </p>
            <Button
              primary
              disabled={!current}
              onClick={async () => {
                setError("");
                try {
                  const data = await ctx.mutate<DemoBackup>(
                    "/api/v1/demo/backup",
                  );
                  download(`neurofence-${ctx.session.environment}.json`, data);
                  ctx.notify("Demo snapshot downloaded");
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              Download demo snapshot
            </Button>
            {!current && (
              <p className="field-help">
                Create or switch to a Demo studio environment first.
              </p>
            )}
          </Panel>
          <Panel
            title="Restore a saved demo"
            sub="Validate the snapshot, review its contents, then restore it into a new environment."
          >
            <label className="field">
              Demo snapshot file
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const sequence = ++fileRead.current;
                  const file = e.target.files?.[0];
                  setBackup(null);
                  setPreview(null);
                  setConfirmed(false);
                  setError("");
                  setFileName(file?.name || "");
                  if (!file) return;
                  try {
                    if (file.size > 800000)
                      throw new Error("Choose a snapshot smaller than 800 KB.");
                    const data = JSON.parse(await file.text()) as DemoBackup;
                    const summary = await ctx.mutate<Preview>(
                      "/api/v1/demo/preview",
                      { backup: data as unknown as Json },
                    );
                    if (sequence === fileRead.current) {
                      setBackup(data);
                      setPreview(summary);
                    }
                  } catch (err) {
                    if (sequence === fileRead.current)
                      setError((err as Error).message);
                  }
                }}
              />
            </label>
            {preview && (
              <div className="restore-preview">
                <h3>{fileName}</h3>
                <p>
                  {preview.environment} · {preview.template} ·{" "}
                  {date(preview.createdAt)}
                </p>
                <p>
                  <strong>{preview.records}</strong> resources and activity
                  records · <strong>{preview.suites}</strong> test suites
                </p>
                <p className="field-help">
                  Checksum verified. This detects file changes; it is not a
                  digital signature.
                </p>
                {preview.companyConfigChanged && (
                  <Notice>
                    Company configuration has changed since this snapshot.
                    Restored resources use the company's current published
                    controls.
                  </Notice>
                )}
                <label className="row consent-row">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  This file contains synthetic demo data only.
                </label>
                <Button
                  primary
                  disabled={!confirmed || !backup}
                  onClick={() =>
                    void launch("/api/v1/demo/restore", {
                      backup: backup as unknown as Json,
                      digest: preview.digest,
                      syntheticOnly: confirmed,
                    })
                  }
                >
                  Restore into new demo
                </Button>
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <Panel
          title="Build a repeatable company demo"
          sub="Each launch creates a separate environment under this company. Published company controls apply to every scenario."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void launch("/api/v1/demo/create", {
                scenario,
                template,
                seed,
                samples,
                syntheticOnly: confirmed,
              });
            }}
          >
            <div className="form-grid demo-options">
              <label className="field">
                Company dataset
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  <option>Financial services</option>
                  <option>Software company</option>
                </select>
              </label>
              <label className="field">
                Dataset seed
                <input
                  type="number"
                  min={1}
                  max={1000000}
                  required
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                />
                <small className="field-help">
                  Reuse a seed for the same sample input sequence.
                </small>
              </label>
              <label className="field">
                Sample requests
                <select
                  value={samples}
                  onChange={(e) => setSamples(Number(e.target.value))}
                >
                  {[0, 12, 24, 40].map((n) => (
                    <option value={n} key={n}>
                      {n === 0
                        ? "Start without activity"
                        : `${n} synthetic requests`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="scenario-picker">
              <legend>Choose a scenario</legend>
              <div className="scenario-grid">
                {demoScenarios.map((s) => (
                  <label
                    key={s.id}
                    className={`scenario-card ${scenario === s.id ? "selected" : ""}`}
                  >
                    <div className="row between">
                      <Icon name={s.icon} />
                      <input
                        type="radio"
                        name="scenario"
                        value={s.id}
                        checked={scenario === s.id}
                        onChange={() => setScenario(s.id)}
                      />
                    </div>
                    <strong>{s.name}</strong>
                    <p>{s.description}</p>
                    <small>{s.expected}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="row between wrap demo-launch">
              <label className="row consent-row">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Use synthetic demo data only.
              </label>
              <Button primary type="submit">
                Create demo environment
              </Button>
            </div>
          </form>
        </Panel>
      )}
      {trace && (
        <Panel
          title="Scenario result"
          sub="This is the decision from the shared mock runtime under the current company controls."
        >
          <TraceView trace={trace} />
        </Panel>
      )}
    </div>
  );
}
