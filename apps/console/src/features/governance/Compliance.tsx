import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { download } from "../../lib/files";
import { Traces } from "../traces/Traces";

export function Compliance() {
  const ctx = useConsole(),
    d = ctx.state.data,
    controls = [
      {
        id: "identity",
        version: 1,
        name: "Identity and scoped access",
        status: d.projects.every((p) => p.owner && p.policy)
          ? "Evidence available"
          : "Needs attention",
        records: d.projects.length,
      },
      {
        id: "policy",
        version: 1,
        name: "Versioned policy enforcement",
        status: d.policies.some((p) => p.status === "Active")
          ? "Evidence available"
          : "Needs attention",
        records: d.policies.length,
      },
      {
        id: "audit",
        version: 1,
        name: "Decision and change history",
        status: d.audit.length ? "Evidence available" : "Needs attention",
        records: d.audit.length,
      },
      {
        id: "assurance",
        version: 1,
        name: "Assurance and remediation",
        status: [...d.campaigns, ...d.scans].some((j) => j.status === "Passed")
          ? "Evidence available"
          : "Needs attention",
        records: d.campaigns.length + d.scans.length,
      },
    ];
  return (
    <>
      <Panel
        title="Evidence coverage"
        sub="Control evidence for review; this is not a certification or compliance determination."
        actions={
          <Button
            onClick={() =>
              download("compliance-evidence-pack.json", {
                prototype: true,
                generatedAt: new Date().toISOString(),
                tenant: ctx.session.tenant,
                environment: ctx.session.environment,
                controls,
                policies: d.policies,
                approvals: d.approvals,
                audit: d.audit,
                traces: d.traces,
              })
            }
          >
            Export evidence pack
          </Button>
        }
      >
        <DataTable
          name="Control evidence"
          rows={controls}
          columns={[
            { key: "name", label: "Control" },
            {
              key: "status",
              label: "Evidence status",
              render: (r) => <Badge value={r.status} />,
            },
            { key: "records", label: "Records" },
          ]}
          onOpen={(r) =>
            ctx.go(
              r.id === "assurance" ? "assurance" : "governance",
              r.id === "assurance" ? "Red team" : "Audit trail",
            )
          }
        />
      </Panel>
      <Traces />
    </>
  );
}
