import { arr, Json, Row, str } from "@neurofence/contracts/types";
import { OperationForm } from "../operations/OperationForm";
import { useConsole } from "../../app/ConsoleContext";
import { useAction } from "../../app/useAction";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";

export function Detectors() {
  const ctx = useConsole(),
    act = useAction();
  const edit = (row?: Row) =>
    ctx.open(
      <OperationForm
        title={row ? "Edit dictionary detector" : "Create dictionary detector"}
        command="detectors/save"
        row={row}
        initial={
          row
            ? {
                name: str(row.name),
                terms: arr(row.terms).join("\n"),
                stages: row.stages as Json,
              }
            : undefined
        }
        fields={[
          { key: "name", label: "Detector name", required: true },
          {
            key: "terms",
            label: "Literal terms (one per line)",
            type: "textarea",
            required: true,
          },
          {
            key: "stages",
            label: "Inspection stages",
            type: "multi",
            options: ["Request", "Response", "Tool arguments", "Tool result"],
            default: ["Request", "Response"],
            required: true,
          },
        ]}
        transform={(body) => ({
          ...body,
          terms: str(body.terms).split("\n"),
          ...(row ? { id: row.id } : {}),
        })}
      />,
    );
  return (
    <Panel
      title="Detector health"
      sub="Pattern fixtures and literal dictionaries. Add a detector to a policy pipeline, simulate the draft, then review and publish it."
      actions={
        <Button primary cap="detectors" onClick={() => edit()}>
          Create dictionary detector
        </Button>
      }
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
              <div className="row">
                {r.kind === "Dictionary" && (
                  <Button cap="detectors" onClick={() => edit(r)}>
                    Edit dictionary
                  </Button>
                )}
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
              </div>
            ),
          },
        ]}
      />
    </Panel>
  );
}
