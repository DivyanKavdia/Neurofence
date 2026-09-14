import { useState } from "react";
import { Json, uid } from "@neurofence/contracts/types";
import {
  inspectionDecisions,
  inspectionStages,
  PolicyCase,
  PolicySuite,
  starterCases,
} from "@neurofence/contracts/policy-lab";
import { useConsole } from "../../../app/ConsoleContext";
import { Button } from "../../../components/Button";
import { download } from "../../../lib/files";

export function SuiteEditor({
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
