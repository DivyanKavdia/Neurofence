import { useEffect, useState } from "react";
import { can } from "@neurofence/contracts/types";
import {
  inspectionDecisions,
  inspectionStages,
  PolicyCase,
  PolicyLabState,
  PolicySuite,
  PolicyTestRun,
} from "@neurofence/contracts/policy-lab";
import { useConsole } from "../../../app/ConsoleContext";
import { Button } from "../../../components/Button";
import { Confirm } from "../../../components/dialogs";
import { Empty } from "../../../components/feedback";
import { Panel } from "../../../components/layout";
import { download } from "../../../lib/files";
import { date } from "../../../lib/format";

import { SuiteEditor } from "./SuiteEditor";
import { RunResults } from "./RunResults";

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
