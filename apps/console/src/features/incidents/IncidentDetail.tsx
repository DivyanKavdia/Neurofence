import { arr, Json, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Confirm, FormDialog } from "../../components/dialogs";
import { Badge, Empty } from "../../components/feedback";
import { Details, Panel } from "../../components/layout";
import { download } from "../../lib/files";
import { date } from "../../lib/format";
import { ExceptionForm } from "../catalog/ExceptionForm";
import { TraceView } from "../traces/TraceView";

export function IncidentDetail({ id }: { id: string }) {
  const ctx = useConsole(),
    row = ctx.state.data.incidents.find((i) => i.id === id);
  if (!row) return <Empty />;
  const trace = ctx.state.data.traces.find((t) => t.id === row.trace);
  const action = (action: string, title: string) =>
    ctx.open(
      <Confirm
        title={title}
        description={str(row.title)}
        verb={title}
        onConfirm={async (reason) => {
          await ctx.mutate(
            `/api/v1/incidents/${id}/${action}`,
            { reason },
            row,
          );
          ctx.open(<IncidentDetail id={id} />);
        }}
      />,
    );
  return (
    <>
      <div className="eyebrow">{id}</div>
      <h2>{str(row.title)}</h2>
      <div className="row">
        <Badge value={row.severity} />
        <Badge value={row.status} />
      </div>
      <p>{str(row.reason)}</p>
      <Details row={row} fields={["source", "owner", "agent", "trace"]} />
      {trace && (
        <Panel title="Correlated runtime evidence">
          <TraceView trace={trace} />
        </Panel>
      )}
      <Panel title="Investigation timeline">
        <div className="waterfall">
          {arr<Record<string, Json>>(row.notes).map((n, i) => (
            <div className="trace-stage" key={i}>
              <div>
                <strong>
                  {str(n.actor)} · {str(n.action || "Review")}
                </strong>
                <p>{str(n.text)}</p>
                <small>{date(n.ts)}</small>
              </div>
            </div>
          ))}
          {!arr(row.notes).length && <p>No review notes yet.</p>}
        </div>
      </Panel>
      <div className="row wrap">
        <Button
          cap="incidents"
          onClick={() =>
            ctx.open(
              <FormDialog
                title="Assign and review incident"
                fields={[
                  {
                    key: "owner",
                    label: "Assigned owner",
                    required: true,
                    default: row.owner,
                  },
                  {
                    key: "reason",
                    label: "Investigation note",
                    type: "textarea",
                    required: true,
                  },
                ]}
                onSubmit={async (body) => {
                  await ctx.mutate(`/api/v1/incidents/${id}/review`, body, row);
                  ctx.open(<IncidentDetail id={id} />);
                }}
                submit="Save review"
              />,
            )
          }
        >
          Assign / add note
        </Button>
        <Button
          cap="incidents"
          disabled={!row.agent}
          danger
          onClick={() => action("contain", "Contain agent")}
        >
          Contain agent
        </Button>
        <Button
          cap="incidents"
          disabled={!trace?.project}
          danger
          onClick={() => action("revoke", "Revoke application key")}
        >
          Revoke key
        </Button>
        <Button
          cap="incidents"
          onClick={() =>
            action(
              row.status === "Resolved" ? "reopen" : "resolve",
              row.status === "Resolved"
                ? "Reopen incident"
                : "Resolve incident",
            )
          }
        >
          {row.status === "Resolved" ? "Reopen" : "Resolve"}
        </Button>
        <Button
          cap="exceptions"
          onClick={() => ctx.open(<ExceptionForm resource={id} />)}
        >
          Request exception
        </Button>
        <Button
          onClick={async () => {
            try {
              download(
                "incident-evidence.json",
                await ctx.mutate(`/api/v1/incidents/${id}/export`, {}, row),
              );
            } catch {}
          }}
        >
          Export evidence
        </Button>
      </div>
    </>
  );
}
