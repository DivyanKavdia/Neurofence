import { arr, num, obj, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Panel, Stats } from "../../components/layout";
import { ResourceDetail } from "../catalog/ResourceDetail";
import { RelationshipView } from "../catalog/RelationshipView";
import { OperationForm } from "../operations/OperationForm";
import { ImportDialog } from "../operations/ImportDialog";

export function Discovery() {
  const ctx = useConsole(),
    assets = ctx.state.data.assets;
  return (
    <div className="stack">
      <Stats
        items={[
          {
            label: "Discovered assets",
            value: assets.length,
            detail: "Scoped inventory records",
          },
          {
            label: "Unprotected",
            value: assets.filter((a) => a.coverage !== "Governed").length,
            detail: "Missing gateway or workforce coverage",
          },
          {
            label: "Elevated risk",
            value: assets.filter((a) => num(a.riskScore) >= 50).length,
            detail: "Calculated score of 50 or higher",
          },
          {
            label: "Unassigned",
            value: assets.filter((a) => !a.owner || a.owner === "Unassigned")
              .length,
            detail: "Accountable owner needed",
          },
        ]}
      />
      <Panel
        title="Discovery & risk"
        sub="A configurable 0–100 score across protection, ownership, classification and approval. Each asset shows its weighted contributors; unknown data receives the conservative score."
        actions={
          <>
            <Button
              cap="assets"
              onClick={() =>
                ctx.open(
                  <OperationForm
                    title="Configure risk weights"
                    command="inventory/weights"
                    row={ctx.state.settings}
                    fields={[
                      ...Object.entries({
                        protection: 35,
                        ownership: 20,
                        classification: 25,
                        approval: 20,
                      }).map(([key, value]) => ({
                        key,
                        label: `${key[0].toUpperCase()}${key.slice(1)} weight`,
                        type: "number" as const,
                        min: 0,
                        max: 100,
                        default: num(
                          obj(ctx.state.settings.riskWeights)[key],
                          value,
                        ),
                        required: true,
                      })),
                    ]}
                    sub="Weights must add up to 100. Scores update without changing your reviewed asset records."
                  />,
                )
              }
            >
              Configure risk weights
            </Button>
            <Button
              primary
              cap="assets"
              onClick={() =>
                ctx.open(
                  <ImportDialog
                    domain="inventory"
                    sample={[
                      {
                        externalId: "support-assistant-v1",
                        name: "Support assistant",
                        type: "Application",
                        owner: ctx.session.user,
                        classification: "Confidential",
                        links: [],
                        components: [
                          {
                            name: "retrieval-index",
                            version: "1.0",
                            license: "Internal",
                          },
                        ],
                      },
                    ]}
                  />,
                )
              }
            >
              Import discovered assets
            </Button>
          </>
        }
      >
        <DataTable
          name="Asset risk"
          rows={assets}
          columns={[
            { key: "name", label: "Asset" },
            { key: "importSource", label: "Discovery source" },
            { key: "owner", label: "Accountable owner" },
            { key: "riskScore", label: "Score / 100" },
            { key: "assessedRisk", label: "Risk band" },
            {
              key: "riskContributors",
              label: "Contributing gaps",
              render: (r) =>
                arr(r.riskContributors)
                  .filter((f) => num(obj(f).points) > 0)
                  .map((f) => `${obj(f).name} +${obj(f).points}`)
                  .join(" · ") || "All four controls recorded",
            },
          ]}
          onOpen={(row) =>
            ctx.open(
              <>
                <h2>{str(row.name)}</h2>
                <RelationshipView row={row} />
                <Button
                  onClick={() => {
                    ctx.open(
                      <ResourceDetail collection="assets" id={row.id} />,
                    );
                  }}
                >
                  Manage ownership and coverage
                </Button>
              </>,
            )
          }
        />
      </Panel>
    </div>
  );
}
