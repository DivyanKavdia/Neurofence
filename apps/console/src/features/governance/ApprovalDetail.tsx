import { Collection, num, obj, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { FormDialog } from "../../components/dialogs";
import { Notice } from "../../components/feedback";
import { Details } from "../../components/layout";
import { date } from "../../lib/format";

export function ApprovalDetail({ id }: { id: string }) {
  const ctx = useConsole(),
    row = ctx.state.data.approvals.find((a) => a.id === id)!;
  const target = row.collection
    ? ctx.state.data[str(row.collection) as Collection]?.find(
        (r) => r.id === row.resource,
      )
    : null;
  return (
    <>
      <h2>Review {str(row.name || row.tool)}</h2>
      <Details
        row={row}
        fields={[
          "kind",
          "requestedBy",
          "scope",
          "workflow",
          "policyVersion",
          "status",
          "reason",
        ]}
      />
      <p>Expires {date(row.expires)}</p>
      {row.args && <pre>{JSON.stringify(row.args, null, 2)}</pre>}
      {target?.draft && (
        <div className="diff-grid">
          <div>
            <strong>Current</strong>
            <pre>
              {JSON.stringify(
                Object.fromEntries(
                  Object.keys(obj(target.draft)).map((k) => [k, target[k]]),
                ),
                null,
                2,
              )}
            </pre>
          </div>
          <div>
            <strong>Proposed</strong>
            <pre>{JSON.stringify(target.draft, null, 2)}</pre>
          </div>
        </div>
      )}
      {row.status === "Pending" && num(row.expires) > Date.now() ? (
        <FormDialog
          title="Record a decision"
          fields={[
            {
              key: "decision",
              label: "Decision",
              type: "select",
              options: ["Approved", "Denied"],
              default: "Approved",
            },
            {
              key: "reason",
              label: "Review reason",
              type: "textarea",
              required: true,
            },
          ]}
          onSubmit={async (body) => {
            await ctx.mutate(`/api/v1/approvals/${id}/decision`, body, row);
            ctx.close();
          }}
          submit="Record decision"
        />
      ) : (
        <Notice>
          This approval is {str(row.status).toLowerCase()} and cannot be reused.
        </Notice>
      )}
    </>
  );
}
