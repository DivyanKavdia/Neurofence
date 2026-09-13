import { useConsole } from "../../app/ConsoleContext";
import { DataTable } from "../../components/DataTable";
import { Confirm } from "../../components/dialogs";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { IncidentDetail } from "./IncidentDetail";

export function Incidents() {
  const ctx = useConsole();
  return (
    <Panel
      title="Incidents & findings"
      sub="Investigate runtime, workforce, budget and assurance findings together."
    >
      <DataTable
        name="Incidents"
        rows={ctx.state.data.incidents}
        columns={[
          { key: "title", label: "Finding" },
          {
            key: "severity",
            label: "Severity",
            render: (r) => <Badge value={r.severity} />,
          },
          { key: "source", label: "Source" },
          { key: "owner", label: "Owner" },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge value={r.status} />,
          },
        ]}
        onOpen={(r) => ctx.open(<IncidentDetail id={r.id} />)}
        bulk={(rows) =>
          ctx.open(
            <Confirm
              title={`Resolve ${rows.length} incidents`}
              description="A resolution note is added to each selected incident."
              verb="Resolve selected"
              onConfirm={async (reason) => {
                for (const row of rows)
                  await ctx.mutate(
                    `/api/v1/incidents/${row.id}/resolve`,
                    { reason },
                    row,
                  );
                ctx.close();
              }}
            />,
          )
        }
      />
    </Panel>
  );
}
