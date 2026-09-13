import { useState } from "react";
import { arr, Json, num, Row, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { FormDialog } from "../../components/dialogs";
import { Panel } from "../../components/layout";
import { Notice } from "../../components/feedback";
import { download } from "../../lib/files";
import { OperationForm } from "../operations/OperationForm";

export function EvidenceLifecycle() {
  const ctx = useConsole(),
    d = ctx.state.data,
    [error, setError] = useState("");
  const previewRetention = async () => {
    try {
      const result = await ctx.mutate<Row>(
        "/api/v1/operations/evidence/retention-preview",
      );
      ctx.open(
        <FormDialog
          title="Review expired content"
          sub={`${arr(result.eligible).length} records eligible; ${num(result.protected)} protected by a hold or pending execution. Trace content is purged; ledger amounts, execution receipts and audit metadata are retained.`}
          submit="Purge eligible content"
          fields={[
            {
              key: "reason",
              label: "Retention action reason",
              type: "textarea",
              required: true,
            },
          ]}
          onSubmit={async (body) => {
            await ctx.mutate("/api/v1/operations/evidence/purge", {
              ...body,
              token: str(result.token),
            });
            ctx.close();
          }}
        >
          <DataTable
            name="Retention preview"
            rows={arr<Row>(result.eligible)}
            columns={[
              { key: "id", label: "Trace" },
              { key: "project", label: "Application" },
            ]}
          />
        </FormDialog>,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    }
  };
  const editControl = (row?: Row) =>
    ctx.open(
      <OperationForm
        title={row ? "Edit evidence mapping" : "Map control evidence"}
        command="evidence/control"
        row={row}
        initial={row as Record<string, Json>}
        fields={[
          { key: "name", label: "Control name", required: true },
          {
            key: "framework",
            label: "Framework / internal standard",
            required: true,
          },
          {
            key: "owner",
            label: "Control owner",
            required: true,
            default: ctx.session.user,
          },
          {
            key: "requirement",
            label: "Requirement or control ID",
            required: true,
          },
          {
            key: "references",
            label: "Evidence records",
            type: "multi",
            options: [
              ...d.assets,
              ...d.policies,
              ...d.traces,
              ...d.incidents,
              ...d.campaigns,
              ...d.scans,
              ...d.approvals,
            ].map((r) => [r.id, `${r.name || r.title || r.id}`]),
            required: true,
          },
        ]}
        transform={(b) => ({ ...b, ...(row ? { id: row.id } : {}) })}
      />,
    );
  return (
    <div className="stack">
      <Panel
        title="Evidence custody & retention"
        sub={`Trace content retention: ${ctx.state.settings.days} days. Holds preserve already retained content; they cannot recover content never collected.`}
        actions={
          <Button cap="evidence" onClick={previewRetention}>
            Preview retention purge
          </Button>
        }
      >
        {error && <p role="alert">{error}</p>}
        <DataTable
          name="Evidence custody"
          rows={d.traces}
          columns={[
            { key: "id", label: "Trace" },
            { key: "project", label: "Application" },
            {
              key: "legalHold",
              label: "Custody",
              render: (r) =>
                r.legalHold
                  ? "On hold"
                  : r.contentPurgedAt
                    ? "Content purged"
                    : "Normal retention",
            },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <Button
                  cap="evidence"
                  disabled={!!row.contentPurgedAt}
                  onClick={() =>
                    ctx.open(
                      <OperationForm
                        title={
                          row.legalHold
                            ? "Release evidence hold"
                            : "Place evidence hold"
                        }
                        command={`evidence/${row.legalHold ? "release" : "hold"}`}
                        row={row}
                        fields={[
                          {
                            key: "reason",
                            label: "Custody reason",
                            type: "textarea",
                            required: true,
                          },
                        ]}
                        transform={(body) => ({ ...body, trace: row.id })}
                      />,
                    )
                  }
                >
                  {row.legalHold ? "Release hold" : "Place hold"}
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Control evidence mappings"
        sub="Map your own framework controls to workspace evidence. A mapping records supporting artifacts; it does not certify compliance."
        actions={
          <Button primary cap="evidence" onClick={() => editControl()}>
            Map control evidence
          </Button>
        }
      >
        <Notice>
          Exports include a SHA-256 integrity manifest and scoped metadata. Raw
          prompts, responses and approval arguments are excluded.
        </Notice>
        <DataTable
          name="Control mappings"
          rows={d.controls}
          columns={[
            { key: "name", label: "Control" },
            { key: "framework", label: "Framework" },
            { key: "requirement", label: "Requirement" },
            { key: "owner", label: "Owner" },
            {
              key: "action",
              label: "Actions",
              render: (row) => (
                <div className="row">
                  <Button cap="evidence" onClick={() => editControl(row)}>
                    Edit mapping
                  </Button>
                  <Button
                    cap="evidenceExport"
                    onClick={async () => {
                      try {
                        download(
                          `evidence-${row.id}.json`,
                          await ctx.mutate(
                            "/api/v1/operations/evidence/export",
                            { control: row.id },
                          ),
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "Export failed.",
                        );
                      }
                    }}
                  >
                    Export evidence
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
