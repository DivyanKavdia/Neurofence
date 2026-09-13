import { Collection } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { Editor } from "./Editor";
import { labels } from "./labels";
import { ResourceDetail } from "./ResourceDetail";

export function Catalog({
  collection,
  title,
  sub,
  columns,
}: {
  collection: Collection;
  title: string;
  sub: string;
  columns?: string[];
}) {
  const ctx = useConsole(),
    keys = columns || ["name", "status", "owner"];
  return (
    <Panel
      title={title}
      sub={sub}
      actions={
        <Button
          cap={collection}
          primary
          onClick={() => ctx.open(<Editor collection={collection} />)}
        >
          Add {labels[collection] || "record"}
        </Button>
      }
    >
      <DataTable
        name={title}
        rows={ctx.state.data[collection]}
        columns={keys.map((key) => ({
          key,
          label: key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s) => s.toUpperCase()),
          render:
            key === "status" ? (r) => <Badge value={r.status} /> : undefined,
        }))}
        onOpen={(r) =>
          ctx.open(<ResourceDetail collection={collection} id={r.id} />)
        }
      />
    </Panel>
  );
}
