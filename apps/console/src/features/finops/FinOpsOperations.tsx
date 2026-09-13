import { num, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Panel } from "../../components/layout";
import { date } from "../../lib/format";
import { resourceOptions } from "../../lib/resource-options";
import { ImportDialog } from "../operations/ImportDialog";
import { OperationForm } from "../operations/OperationForm";

export function FinOpsOperations() {
  const ctx = useConsole(),
    d = ctx.state.data;
  return (
    <div className="stack">
      <Panel
        title="Effective prices"
        sub="Immutable INR price versions per million tokens for external usage imports. Existing gateway model prices and operator quotes remain separate."
        actions={
          <Button
            primary
            cap="budgets"
            onClick={() =>
              ctx.open(
                <OperationForm
                  title="Publish price version"
                  command="finops/price"
                  fields={[
                    {
                      key: "model",
                      label: "Model",
                      type: "select",
                      options: resourceOptions(ctx.state, "models"),
                      required: true,
                    },
                    {
                      key: "effectiveAt",
                      label: "Effective from",
                      type: "datetime",
                      default: Date.now() - 86400000,
                      required: true,
                    },
                    {
                      key: "currency",
                      label: "Ledger currency",
                      type: "select",
                      options: ["INR"],
                      default: "INR",
                    },
                    ...["input", "output", "cache", "reasoning"].map((key) => ({
                      key: `${key}Rate`,
                      label: `${key[0].toUpperCase() + key.slice(1)} / million tokens`,
                      type: "number" as const,
                      min: 0,
                      default: key === "output" ? 900 : 350,
                      required: true,
                    })),
                  ]}
                />,
              )
            }
          >
            Publish price version
          </Button>
        }
      >
        <DataTable
          name="Price versions"
          rows={d.prices}
          columns={[
            { key: "name", label: "Model" },
            {
              key: "effectiveAt",
              label: "Effective from",
              render: (r) => date(r.effectiveAt),
            },
            ...["inputRate", "outputRate", "cacheRate", "reasoningRate"].map(
              (key) => ({ key, label: key.replace("Rate", " INR") }),
            ),
          ]}
        />
      </Panel>
      <Panel
        title="Usage imports & invoice reconciliation"
        sub="External IDs prevent duplicate billing. Reconciliation preserves the previous amount, invoice reference, reason and actor. Held requests are resolved without replaying a provider call."
        actions={
          <Button
            primary
            cap="budgets"
            onClick={() =>
              ctx.open(
                <ImportDialog
                  domain="finops"
                  sample={[
                    {
                      externalId: "invoice-line-001",
                      project: d.projects[0]?.id || "claims",
                      model: d.models[0]?.id || "",
                      ts: Date.now() - 60000,
                      inputTokens: 1200,
                      outputTokens: 400,
                      cacheTokens: 100,
                      reasoningTokens: 0,
                      costCenter: "Customer operations",
                    },
                  ]}
                />,
              )
            }
          >
            Import external usage
          </Button>
        }
      >
        <DataTable
          name="Reconciliation ledger"
          rows={d.traces.filter((t) => t.executed || t.pendingCost)}
          columns={[
            { key: "id", label: "Trace" },
            { key: "project", label: "Application" },
            { key: "importSource", label: "Usage source" },
            { key: "costCenter", label: "Cost center" },
            { key: "cost", label: "INR" },
            { key: "reconciliation", label: "Invoice status" },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <Button
                  cap="budgets"
                  onClick={() =>
                    ctx.open(
                      <OperationForm
                        title="Reconcile invoice amount"
                        command="finops/reconcile"
                        row={row}
                        fields={[
                          {
                            key: "invoice",
                            label: "Invoice reference",
                            required: true,
                            default: str(row.invoice),
                          },
                          {
                            key: "cost",
                            label: "Verified total (INR)",
                            type: "number",
                            min: 0,
                            default: num(row.cost),
                            required: true,
                          },
                          {
                            key: "reason",
                            label: "Reconciliation reason",
                            type: "textarea",
                            required: true,
                          },
                        ]}
                        transform={(b) => ({ ...b, trace: row.id })}
                      />,
                    )
                  }
                >
                  Reconcile
                </Button>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
