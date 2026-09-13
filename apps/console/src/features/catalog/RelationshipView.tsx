import { arr, Collection, Row, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Panel } from "../../components/layout";
import { ResourceDetail } from "./ResourceDetail";

export function RelationshipView({ row }: { row: Row }) {
  const ctx = useConsole(),
    all = [
      "assets",
      "projects",
      "agents",
      "routes",
      "policies",
      "budgets",
      "tools",
    ] as Collection[],
    links = arr<string>(row.links);
  return (
    <Panel
      title="Related objects"
      sub="Select a relationship to inspect the connected configuration."
    >
      <div className="relationship">
        <div className="relationship-center">{str(row.name)}</div>
        <div className="relationship-items">
          {links.map((id) => {
            const c = all.find((c) =>
                ctx.state.data[c].some((r) => r.id === id),
              ),
              item = c ? ctx.state.data[c].find((r) => r.id === id) : null;
            return (
              <Button
                key={id}
                onClick={() =>
                  c && ctx.open(<ResourceDetail collection={c} id={id} />)
                }
              >
                {str(item?.name || id)} →
              </Button>
            );
          })}
          {!links.length && <p>No relationships are recorded yet.</p>}
        </div>
      </div>
    </Panel>
  );
}
