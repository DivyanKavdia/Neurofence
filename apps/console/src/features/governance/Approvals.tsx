import { num, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { DataTable } from "../../components/DataTable";
import { Badge, Notice } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { date } from "../../lib/format";
import { ApprovalDetail } from "./ApprovalDetail";

export function Approvals() {
  const ctx = useConsole();
  return (
    <>
      <Notice>
        Four-eyes review uses separate demo identities. Switch the reviewer
        identity in the profile menu when reviewing your own configuration
        request.
      </Notice>
      <Panel
        title="Approval queue"
        sub="Review configuration drafts, scoped exceptions and exact tool requests."
      >
        <DataTable
          name="Approvals"
          rows={ctx.state.data.approvals}
          columns={[
            {
              key: "name",
              label: "Request",
              render: (r) => str(r.name || r.tool),
            },
            { key: "kind", label: "Type" },
            { key: "requestedBy", label: "Requested by" },
            { key: "expires", label: "Expiry", render: (r) => date(r.expires) },
            {
              key: "status",
              label: "Decision",
              render: (r) => (
                <Badge
                  value={
                    num(r.expires) < Date.now() && r.status === "Pending"
                      ? "Expired"
                      : r.status
                  }
                />
              ),
            },
          ]}
          onOpen={(r) => ctx.open(<ApprovalDetail id={r.id} />)}
        />
      </Panel>
    </>
  );
}
