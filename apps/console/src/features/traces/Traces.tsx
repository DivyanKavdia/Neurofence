import { str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { date, money } from "../../lib/format";
import { TraceView } from "./TraceView";

export function Traces({
  kind,
  compact = false,
}: {
  kind?: string;
  compact?: boolean;
}) {
  const ctx = useConsole(),
    rows = ctx.state.data.traces.filter((t) => !kind || t.kind === kind);
  return (
    <Panel
      title={compact ? "Recent governed activity" : "Runtime trace explorer"}
      sub="Identity, policy, routing, guardrails, usage and evidence share one trace."
    >
      <DataTable
        name="Traces"
        rows={compact ? rows.slice(0, 5) : rows}
        columns={[
          { key: "ts", label: "Time", render: (r) => date(r.ts) },
          { key: "target", label: "Model / tool" },
          {
            key: "project",
            label: "Application",
            render: (r) =>
              str(
                ctx.state.data.projects.find((p) => p.id === r.project)?.name ||
                  r.project,
              ),
          },
          {
            key: "decision",
            label: "Decision",
            render: (r) => <Badge value={r.decision} />,
          },
          {
            key: "cost",
            label: "Cost",
            render: (r) => (
              <>
                {money(r.cost)}
                {r.pendingCost ? " (pending)" : ""}
              </>
            ),
          },
        ]}
        onOpen={(r) =>
          ctx.open(
            <>
              <h2>Runtime trace</h2>
              <TraceView trace={r} />
            </>,
          )
        }
      />
    </Panel>
  );
}
