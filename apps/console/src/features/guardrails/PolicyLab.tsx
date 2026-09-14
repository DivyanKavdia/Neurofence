import { useEffect, useState } from "react";
import { can, Json, uid } from "@neurofence/contracts/types";
import {
  inspectionDecisions,
  inspectionStages,
  PolicyCase,
  PolicyLabState,
  PolicySuite,
  PolicyTestRun,
  starterCases,
} from "@neurofence/contracts/policy-lab";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Confirm } from "../../components/dialogs";
import { Badge, Empty, Notice } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { download } from "../../lib/files";
import { date } from "../../lib/format";

function SuiteEditor({
  suite,
  initial,
  saved,
}: {
  suite?: PolicySuite;
  initial?: Partial<PolicySuite>;
  saved: (suite: PolicySuite) => void;
}) {
  const ctx = useConsole();
  const [name, setName] = useState(
    initial?.name || suite?.name || "Baseline safety checks",
  );
  const [policy, setPolicy] = useState(
    initial?.policy || suite?.policy || ctx.state.data.policies[0]?.id || "",
  );
  const [cases, setCases] = useState<PolicyCase[]>(() =>
    structuredClone(initial?.cases || suite?.cases || starterCases),
  );
  const [synthetic, setSynthetic] = useState(false),
    [error, setError] = useState("");
  const change = (id: string, values: Partial<PolicyCase>) =>
    setCases((old) => old.map((c) => (c.id === id ? { ...c, ...values } : c)));
  return (
    <>
      <h2>{suite ? "Edit test suite" : "Create test suite"}</h2>
      <p className="page-sub">
        Save repeatable checks for one policy. Inputs remain in this company's
        demo environment.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const result = await ctx.mutate<PolicySuite>(
              `/api/v1/policy-tests${suite ? `/${suite.id}` : ""}`,
              {
                name,
                policy,
                cases: cases as unknown as Json,
                syntheticOnly: synthetic,
              },
              suite ? { id: suite.id, version: suite.version } : undefined,
              suite ? "PATCH" : "POST",
            );
            saved(result);
            ctx.close();
            ctx.notify("Test suite saved");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Suite name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label className="field">
            Bound policy
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              required
            >
              <option value="" disabled>
                Select a policy
              </option>
              {ctx.state.data.policies.map((p) => (
                <option value={p.id} key={p.id}>
                  {String(p.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row between wrap">
          <h3>
            Test cases <span className="quiet">{cases.length}/30</span>
          </h3>
          <Button
            disabled={cases.length >= 30}
            onClick={() =>
              setCases([
                ...cases,
                {
                  id: uid("case"),
                  name: "",
                  stage: "Request",
                  text: "",
                  expected: "ALLOW",
                  forbiddenText: "",
                },
              ])
            }
          >
            Add test case
          </Button>
        </div>
        <div className="suite-cases">
          {cases.map((c, i) => (
            <fieldset className="suite-case" key={c.id}>
              <legend>Case {i + 1}</legend>
              <div className="form-grid">
                <label className="field">
                  Case {i + 1} name
                  <input
                    value={c.name}
                    required
                    maxLength={120}
                    onChange={(e) => change(c.id, { name: e.target.value })}
                  />
                </label>
                <label className="field">
                  Case {i + 1} stage
                  <select
                    value={c.stage}
                    onChange={(e) =>
                      change(c.id, {
                        stage: e.target.value as PolicyCase["stage"],
                      })
                    }
                  >
                    {inspectionStages.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="field full">
                  Case {i + 1} input
                  <textarea
                    value={c.text}
                    rows={2}
                    required
                    maxLength={8000}
                    onChange={(e) => change(c.id, { text: e.target.value })}
                  />
                </label>
                <label className="field">
                  Case {i + 1} expected decision
                  <select
                    value={c.expected}
                    onChange={(e) =>
                      change(c.id, {
                        expected: e.target.value as PolicyCase["expected"],
                      })
                    }
                  >
                    {inspectionDecisions.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Case {i + 1} text to exclude from output
                  <input
                    value={c.forbiddenText}
                    maxLength={200}
                    placeholder="Optional exact text"
                    onChange={(e) =>
                      change(c.id, { forbiddenText: e.target.value })
                    }
                  />
                </label>
              </div>
              <Button
                danger
                disabled={cases.length === 1}
                onClick={() =>
                  setCases(cases.filter((item) => item.id !== c.id))
                }
              >
                Remove case {i + 1}
              </Button>
            </fieldset>
          ))}
        </div>
        <label className="row consent-row">
          <input
            type="checkbox"
            required
            checked={synthetic}
            onChange={(e) => setSynthetic(e.target.checked)}
          />
          These inputs contain synthetic demo data only.
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error} Your inputs are still available here.
          </p>
        )}
        <div className="dialog-actions">
          <Button
            onClick={() =>
              download("policy-suite-draft.json", {
                format: "neurofence-policy-suite",
                schema: 1,
                suite: { name, policy, cases },
              })
            }
          >
            Download inputs
          </Button>
          <Button onClick={ctx.close}>Cancel</Button>
          <Button primary type="submit">
            Save test suite
          </Button>
        </div>
      </form>
    </>
  );
}

function RunResults({ run }: { run: PolicyTestRun }) {
  const [filter, setFilter] = useState("All cases"),
    [selected, setSelected] = useState(run.results[0]?.id || "");
  const rows = run.results.filter(
    (r) =>
      filter === "All cases" ||
      (filter === "Changed" ? r.changed : !r.candidate.passed),
  );
  const detail = run.results.find((r) => r.id === selected);
  return (
    <>
      {run.stale && (
        <Notice>
          This result is historical. The suite or inspection configuration has
          changed; run the saved suite again.
        </Notice>
      )}
      {!run.hasDraft && (
        <Notice>
          No draft was available for this run. Both sides evaluated the active
          policy.
        </Notice>
      )}
      <div className="lab-metrics" aria-label="Comparison summary">
        <div>
          <strong>
            {run.results.length - run.failures}/{run.results.length}
          </strong>
          <span>Draft expectations passed</span>
        </div>
        <div>
          <strong>{run.changed}</strong>
          <span>Changed cases</span>
        </div>
        <div className={run.regressions ? "metric-alert" : ""}>
          <strong>{run.regressions}</strong>
          <span>New failures</span>
        </div>
      </div>
      <div className="row between wrap">
        <p className="quiet">
          {date(run.ts)} · {run.actor} · Policy v{run.policyVersion} · Company v
          {run.companyVersion}
        </p>
        <label className="field inline-field">
          Show cases
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["All cases", "Changed", "Failed expectations"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table className="lab-results">
          <thead>
            <tr>
              <th>Test case</th>
              <th>Expected</th>
              <th>Active</th>
              <th>Draft</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={selected === r.id ? "selected-row" : ""}
              >
                <td>
                  <button
                    className="text-link"
                    onClick={() => setSelected(r.id)}
                  >
                    {r.name}
                  </button>
                  <small>{r.stage}</small>
                </td>
                <td>{r.expected}</td>
                <td>
                  <Badge value={r.active.decision} />
                </td>
                <td>
                  <Badge value={r.candidate.decision} />
                </td>
                <td>
                  <Badge value={r.candidate.passed ? "Passed" : "Failed"} />
                  {r.regression && <small>New failure</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <Empty
          title="No cases in this filter"
          text="Choose All cases to review the complete comparison."
        />
      )}
      {detail && (
        <section
          className="comparison-detail"
          aria-label={`${detail.name} comparison`}
        >
          <h3>{detail.name}</h3>
          <div className="comparison-columns">
            {(["active", "candidate"] as const).map((side) => (
              <div key={side}>
                <h4>{side === "active" ? "Active policy" : "Draft policy"}</h4>
                <p>{detail[side].reason}</p>
                <pre>
                  {detail[side].decision === "DENY"
                    ? "Output withheld"
                    : detail[side].output || "No output"}
                </pre>
                <small>
                  {detail[side].matches} matches ·{" "}
                  {detail[side].rules.join(", ") || "No matching rules"}
                </small>
              </div>
            ))}
          </div>
          <p className="field-help">
            Output previews show up to 500 characters. Expectations check the
            complete output. A new failure passed against active policy and
            failed against the draft.
          </p>
        </section>
      )}
    </>
  );
}

export function PolicyLab() {
  const ctx = useConsole(),
    allowed = can(ctx.session, "run") || can(ctx.session, "policies");
  const [lab, setLab] = useState<PolicyLabState>({ suites: [], runs: [] }),
    [selected, setSelected] = useState(""),
    [runId, setRunId] = useState("");
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    if (!allowed) {
      setLoading(false);
      return;
    }
    ctx
      .request<PolicyLabState>({ path: "/api/v1/policy-tests" })
      .then((data) => {
        if (current) {
          setLab(data);
          setLoading(false);
          setError("");
        }
      })
      .catch((err) => {
        if (current) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [ctx.state.revision, ctx.session.user, ctx.session.role, allowed]);
  const suite = lab.suites.find((s) => s.id === selected) || lab.suites[0];
  const runs = lab.runs.filter((r) => r.suite === suite?.id);
  const run = runs.find((r) => r.id === runId) || runs[0];
  const saved = (value: PolicySuite) => {
    setLab((old) => ({
      suites: [value, ...old.suites.filter((s) => s.id !== value.id)],
      runs: old.runs.map((r) =>
        r.suite === value.id ? { ...r, stale: true } : r,
      ),
    }));
    setSelected(value.id);
    setRunId("");
  };
  if (!allowed)
    return (
      <Empty
        title="Policy testing requires simulation access"
        text="Select a member with Run or Policies permission to create and run synthetic test suites."
      />
    );
  return (
    <div className="stack">
      <Panel
        title="Policy test lab"
        sub="Compare a saved set of inputs against active and draft policy before publication."
        actions={
          <Button
            primary
            disabled={!ctx.state.data.policies.length}
            onClick={() => ctx.open(<SuiteEditor saved={saved} />)}
          >
            Create test suite
          </Button>
        }
      >
        <div className="row between wrap">
          <p className="quiet">
            Same inspection engine as the gateway · No model calls or provider
            charges
          </p>
          <label className="file-action">
            Import test inputs
            <input
              aria-label="Import test inputs"
              type="file"
              accept=".json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 100000)
                    throw new Error("Choose a test input file below 100 KB.");
                  const data = JSON.parse(await file.text());
                  if (
                    data.format !== "neurofence-policy-suite" ||
                    data.schema !== 1 ||
                    typeof data.suite?.name !== "string" ||
                    typeof data.suite?.policy !== "string" ||
                    !Array.isArray(data.suite?.cases) ||
                    data.suite.cases.length < 1 ||
                    data.suite.cases.length > 30 ||
                    !data.suite.cases.every(
                      (c: PolicyCase) =>
                        c &&
                        typeof c.id === "string" &&
                        typeof c.name === "string" &&
                        typeof c.text === "string" &&
                        typeof c.forbiddenText === "string" &&
                        inspectionStages.includes(c.stage) &&
                        inspectionDecisions.includes(c.expected),
                    )
                  )
                    throw new Error("Choose a valid exported test suite.");
                  ctx.open(<SuiteEditor initial={data.suite} saved={saved} />);
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Loading saved suites…</p>
        ) : !suite ? (
          <Empty
            title="Start with a repeatable safety check"
            text="Create a suite with the four starter cases, or import your own synthetic test inputs."
          />
        ) : (
          <div className="lab-layout">
            <aside className="suite-list" aria-label="Saved test suites">
              {lab.suites.map((s) => (
                <button
                  key={s.id}
                  aria-pressed={suite.id === s.id}
                  onClick={() => {
                    setSelected(s.id);
                    setRunId("");
                  }}
                >
                  <strong>{s.name}</strong>
                  <span>
                    {s.cases.length} cases · Version {s.version}
                  </span>
                </button>
              ))}
            </aside>
            <div className="lab-content">
              <div className="row between wrap">
                <div>
                  <h3>{suite.name}</h3>
                  <p className="quiet">
                    {String(
                      ctx.state.data.policies.find((p) => p.id === suite.policy)
                        ?.name || "Policy unavailable",
                    )}{" "}
                    · {suite.cases.length} cases
                  </p>
                </div>
                <Button
                  primary
                  onClick={async () => {
                    try {
                      const result = await ctx.mutate<PolicyTestRun>(
                        `/api/v1/policy-tests/${suite.id}/run`,
                        {},
                        { id: suite.id, version: suite.version },
                      );
                      setLab((old) => ({
                        ...old,
                        runs: [
                          result,
                          ...old.runs.filter((r) => r.id !== result.id),
                        ].slice(0, 20),
                      }));
                      setRunId(result.id);
                      ctx.notify(`${result.results.length} cases compared`);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  Compare active and draft
                </Button>
              </div>
              <div className="row wrap lab-tools">
                <Button
                  onClick={() =>
                    ctx.open(<SuiteEditor suite={suite} saved={saved} />)
                  }
                >
                  Edit inputs
                </Button>
                <Button
                  onClick={() =>
                    download("policy-test-suite.json", {
                      format: "neurofence-policy-suite",
                      schema: 1,
                      suite: {
                        name: suite.name,
                        policy: suite.policy,
                        cases: suite.cases,
                      },
                    })
                  }
                >
                  Export inputs
                </Button>
                <Button
                  danger
                  onClick={() =>
                    ctx.open(
                      <Confirm
                        title="Delete test suite"
                        description={`Remove ${suite.name} and its saved comparison results.`}
                        verb="Delete suite"
                        onConfirm={async () => {
                          await ctx.mutate(
                            `/api/v1/policy-tests/${suite.id}`,
                            {},
                            { id: suite.id, version: suite.version },
                            "DELETE",
                          );
                          ctx.close();
                          setSelected("");
                          setRunId("");
                        }}
                      />,
                    )
                  }
                >
                  Delete suite
                </Button>
              </div>
              {run ? (
                <>
                  <div className="row between wrap">
                    <label className="field inline-field">
                      Run history
                      <select
                        value={run.id}
                        onChange={(e) => setRunId(e.target.value)}
                      >
                        {runs.map((r) => (
                          <option value={r.id} key={r.id}>
                            {date(r.ts)} · {r.failures} failed · Suite v
                            {r.suiteVersion}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      onClick={() =>
                        download("policy-comparison.json", {
                          prototype: true,
                          ...run,
                        })
                      }
                    >
                      Export comparison
                    </Button>
                  </div>
                  <RunResults key={run.id} run={run} />
                </>
              ) : (
                <Empty
                  title="Ready for your first comparison"
                  text="Run the saved inputs to see decision changes, redaction differences and failed expectations."
                />
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
