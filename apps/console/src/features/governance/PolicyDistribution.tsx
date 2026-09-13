import { str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Panel } from "../../components/layout";
import { Notice } from "../../components/feedback";
import { date } from "../../lib/format";
import { OperationForm } from "../operations/OperationForm";

export function PolicyDistribution() {
  const ctx = useConsole();
  return (
    <Panel
      title="Policy distribution"
      sub="Build → verify integrity → acknowledge → enforce until expiry. Published policy changes require a fresh acknowledgement."
      actions={
        <Button
          primary
          cap="distribution"
          onClick={() =>
            ctx.open(
              <OperationForm
                title="Build policy bundle"
                sub="This enables acknowledgement enforcement. Model and tool calls pause until the latest bundle is acknowledged successfully."
                command="distribution/build"
                fields={[
                  {
                    key: "ttl",
                    label: "Bundle lifetime (seconds)",
                    type: "number",
                    min: 60,
                    max: 86400,
                    default: 3600,
                    required: true,
                  },
                ]}
              />,
            )
          }
        >
          Build policy bundle
        </Button>
      }
    >
      <Notice>
        {ctx.state.settings.managedDistribution
          ? "Acknowledgement enforcement is active. "
          : "Build the first bundle to activate acknowledgement enforcement. "}
        This prototype uses an integrity hash and simulated acknowledgements.
        Production signing keys and data-plane delivery are separate deployment
        work.
      </Notice>
      <DataTable
        name="Policy bundles"
        rows={ctx.state.data.distributions}
        columns={[
          { key: "name", label: "Bundle" },
          { key: "status", label: "Acknowledgement" },
          {
            key: "expiresAt",
            label: "Expires",
            render: (r) => date(r.expiresAt),
          },
          {
            key: "sha256",
            label: "SHA-256",
            render: (r) => (
              <code title={str(r.sha256)}>{str(r.sha256).slice(0, 20)}…</code>
            ),
          },
          {
            key: "action",
            label: "Action",
            render: (row) => (
              <Button
                cap="distribution"
                disabled={
                  row.id !== ctx.state.data.distributions[0]?.id ||
                  row.status === "Acknowledged"
                }
                onClick={() =>
                  ctx.open(
                    <OperationForm
                      title="Record data-plane acknowledgement"
                      command="distribution/acknowledge"
                      row={row}
                      fields={[
                        {
                          key: "outcome",
                          label: "Simulated delivery outcome",
                          type: "select",
                          options: [
                            ["success", "Acknowledged"],
                            ["failure", "Delivery failed"],
                          ],
                          default: "success",
                          required: true,
                        },
                      ]}
                      transform={(body) => ({ ...body, bundle: row.id })}
                    />,
                  )
                }
              >
                Acknowledge bundle
              </Button>
            ),
          },
        ]}
      />
    </Panel>
  );
}
