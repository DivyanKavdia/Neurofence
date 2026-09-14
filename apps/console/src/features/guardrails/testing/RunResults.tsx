import { useState } from "react";
import { PolicyTestRun } from "@neurofence/contracts/policy-lab";
import { Badge, Empty, Notice } from "../../../components/feedback";
import { date } from "../../../lib/format";

export function RunResults({ run }: { run: PolicyTestRun }) {
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
