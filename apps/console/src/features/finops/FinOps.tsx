import { num, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/feedback";
import { Panel, Stats } from "../../components/layout";
import { download } from "../../lib/files";
import { money } from "../../lib/format";
import { ResourceDetail } from "../catalog/ResourceDetail";
import { TraceView } from "../traces/TraceView";

export function FinOps({ forecast }: { forecast: boolean }) {
  const ctx = useConsole(),
    d = ctx.state.data,
    spend = d.traces.reduce((n, t) => n + num(t.cost), 0),
    first = Math.min(Date.now(), ...d.traces.map((t) => num(t.ts, Date.now()))),
    days = Math.max(1, (Date.now() - first) / 86400000),
    prediction = (spend / days) * 30,
    average = spend / Math.max(1, d.traces.length),
    anomalies = d.traces.filter((t) => num(t.cost) > average * 2);
  return (
    <>
      <Stats
        items={[
          {
            label: "Attributed spend",
            value: money(spend),
            detail: "Persisted sample ledger",
            go: () => ctx.go("budgets", "Usage ledger"),
          },
          {
            label: "30-day forecast",
            value: money(prediction),
            detail: `Linear projection from ${Math.ceil(days)} observed days`,
            go: () => ctx.go("budgets", "Forecast & anomalies"),
          },
          {
            label: "Pending estimates",
            value: money(
              d.traces
                .filter((t) => t.pendingCost)
                .reduce((n, t) => n + num(t.cost), 0),
            ),
            detail: "Included in spend until reconciled",
            go: () => ctx.go("budgets", "Usage ledger"),
          },
          {
            label: "Cost anomalies",
            value: anomalies.length,
            detail: "Requests above twice the mean",
            go: () => ctx.go("budgets", "Forecast & anomalies"),
          },
        ]}
      />
      <div className="cols equal">
        <Panel
          title="Spend by application"
          sub="Open an application to inspect its bindings and access."
        >
          <div className="spend-bars">
            {d.projects.map((p) => {
              const used = d.traces
                .filter((t) => t.project === p.id)
                .reduce((n, t) => n + num(t.cost), 0);
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    ctx.open(<ResourceDetail collection="projects" id={p.id} />)
                  }
                >
                  <div className="row between">
                    <span>{str(p.name)}</span>
                    <strong>{money(used)}</strong>
                  </div>
                  <progress max={Math.max(1, spend)} value={used} />
                </button>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Forecast and allocation"
          sub="Simple, visible assumptions for the prototype."
        >
          <p>
            The 30-day estimate continues the observed average daily spend. It
            does not model seasonality.
          </p>
          <p>
            Usage follows the application’s budget binding recorded at request
            time; later binding changes preserve historical attribution.
          </p>
          <Button
            onClick={() =>
              download("finops-allocation.json", {
                prototype: true,
                currency: "INR",
                spend,
                observedDays: days,
                forecast30Days: prediction,
                allocation: d.projects.map((p) => ({
                  application: p.name,
                  spend: d.traces
                    .filter((t) => t.project === p.id)
                    .reduce((n, t) => n + num(t.cost), 0),
                })),
              })
            }
          >
            Export allocation
          </Button>
        </Panel>
      </div>
      {forecast && (
        <Panel
          title="Anomaly investigation"
          sub="Each candidate opens the exact contributing trace."
        >
          <DataTable
            name="Cost anomalies"
            rows={anomalies}
            columns={[
              { key: "target", label: "Model" },
              { key: "project", label: "Application" },
              { key: "cost", label: "Cost", render: (t) => money(t.cost) },
              {
                key: "decision",
                label: "Decision",
                render: (t) => <Badge value={t.decision} />,
              },
            ]}
            onOpen={(r) =>
              ctx.open(
                <>
                  <h2>Cost anomaly trace</h2>
                  <TraceView trace={r} />
                </>,
              )
            }
          />
        </Panel>
      )}
    </>
  );
}
