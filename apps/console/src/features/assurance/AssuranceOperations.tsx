import { str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Panel } from "../../components/layout";
import { date } from "../../lib/format";
import { OperationForm } from "../operations/OperationForm";

export function AssuranceOperations() {
  const ctx = useConsole();
  return (
    <div className="stack">
      <Panel
        title="Campaign schedules"
        sub="Daily and weekly sample jobs start on the next workspace poll after their due time. Missed intervals coalesce into one run; the prototype does not run a background scheduler."
      >
        <DataTable
          name="Scheduled campaigns"
          rows={ctx.state.data.campaigns}
          columns={[
            { key: "name", label: "Campaign" },
            { key: "schedule", label: "Cadence" },
            {
              key: "nextRunAt",
              label: "Next run",
              render: (r) => (r.scheduleEnabled ? date(r.nextRunAt) : "Manual"),
            },
            { key: "status", label: "Status" },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <Button
                  cap="campaigns"
                  disabled={row.status === "Running"}
                  onClick={() =>
                    ctx.open(
                      <OperationForm
                        title="Schedule campaign"
                        command="assurance/schedule"
                        row={row}
                        fields={[
                          {
                            key: "schedule",
                            label: "Cadence",
                            type: "select",
                            options: ["Manual", "Daily", "Weekly"],
                            default: "Daily",
                            required: true,
                          },
                          {
                            key: "nextRunAt",
                            label: "Next run",
                            type: "datetime",
                            default: Date.now() + 3600000,
                          },
                        ]}
                        transform={(b) => ({ ...b, id: row.id })}
                      />,
                    )
                  }
                >
                  Edit schedule
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Artifact provenance & drift"
        sub="Record the SHA-256 digest, publisher and license. A change quarantines the artifact, invalidates remediation and blocks release until another passing retest."
      >
        <DataTable
          name="Artifact provenance"
          rows={ctx.state.data.scans}
          columns={[
            { key: "name", label: "Artifact" },
            {
              key: "digest",
              label: "Digest",
              render: (r) => str(r.digest).slice(0, 16) || "Not recorded",
            },
            { key: "publisher", label: "Publisher" },
            { key: "license", label: "License" },
            { key: "gate", label: "Gate" },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <Button
                  cap="scans"
                  disabled={row.status === "Running"}
                  onClick={() =>
                    ctx.open(
                      <OperationForm
                        title="Record artifact provenance"
                        sub="Metadata is operator supplied. This prototype does not download or cryptographically verify the artifact."
                        command="assurance/provenance"
                        row={row}
                        fields={[
                          {
                            key: "digest",
                            label: "SHA-256 digest",
                            default: str(row.digest),
                            required: true,
                          },
                          {
                            key: "publisher",
                            label: "Publisher",
                            default: str(row.publisher),
                            required: true,
                          },
                          {
                            key: "license",
                            label: "License identifier",
                            default: str(row.license),
                            required: true,
                          },
                        ]}
                        transform={(b) => ({ ...b, id: row.id })}
                      />,
                    )
                  }
                >
                  Record provenance
                </Button>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
