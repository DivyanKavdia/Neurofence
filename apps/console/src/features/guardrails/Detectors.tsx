import { useConsole } from "../../app/ConsoleContext";
import { useAction } from "../../app/useAction";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";

export function Detectors() {
  const ctx = useConsole(),
    act = useAction();
  return (
    <Panel
      title="Detector health"
      sub="Pattern-based fixtures stand in for production detectors."
    >
      <DataTable
        name="Detectors"
        rows={ctx.state.data.detectors}
        columns={[
          { key: "name", label: "Detector" },
          { key: "stage", label: "Stages" },
          {
            key: "critical",
            label: "Critical",
            render: (r) => (r.critical ? "Mandatory" : "Optional"),
          },
          {
            key: "latency",
            label: "Sample latency",
            render: (r) => `${r.latency} ms`,
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge value={r.status} />,
          },
          {
            key: "action",
            label: "Action",
            render: (r) => (
              <Button
                cap="detectors"
                disabled={!!r.critical}
                onClick={() =>
                  act(
                    `/api/v1/detectors/${r.id}`,
                    { status: r.status === "Active" ? "Disabled" : "Active" },
                    r,
                    "PATCH",
                  )
                }
              >
                {r.status === "Active" ? "Disable" : "Enable"}
              </Button>
            ),
          },
        ]}
      />
    </Panel>
  );
}
