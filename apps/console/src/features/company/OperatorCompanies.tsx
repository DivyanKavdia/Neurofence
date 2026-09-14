import { useEffect, useState } from "react";
import { CompanySummary, moduleOptions } from "@neurofence/contracts/company";
import { Json, Row, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { OperationForm } from "../operations/OperationForm";
import { Onboarding } from "./Onboarding";

export function OperatorCompanies() {
  const ctx = useConsole();
  const [companies, setCompanies] = useState<
    (CompanySummary & { provisioning: Row[] })[]
  >([]);
  useEffect(() => {
    let active = true;
    void ctx
      .request<typeof companies>({ path: "/api/v1/companies" })
      .then((c) => {
        if (active) setCompanies(c);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ctx.state.revision]);
  const request = (
    company: CompanySummary,
    action: string,
    fields: Parameters<typeof OperationForm>[0]["fields"],
    initial: Record<string, Json> = {},
  ) =>
    ctx.open(
      <OperationForm
        title={`Company ${action}`}
        command={`/api/v1/companies/${company.id}/${action}`}
        row={{ id: company.id, version: company.version }}
        fields={[
          ...fields,
          {
            key: "reason",
            label: "Operator reason",
            type: "textarea",
            required: true,
          },
        ]}
        initial={initial}
      />,
    );
  return (
    <div className="stack">
      <Panel
        title="Companies"
        sub="Provision company boundaries and entitlements. Company memberships govern access to their application data."
        actions={
          <Button
            primary
            cap="companies"
            onClick={() => ctx.open(<Onboarding />)}
          >
            Onboard company
          </Button>
        }
      >
        <DataTable
          name="Registered companies"
          rows={companies as unknown as Row[]}
          columns={[
            { key: "name", label: "Company" },
            { key: "id", label: "Identifier" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge value={r.status} />,
            },
            {
              key: "environments",
              label: "Environments",
              render: (r) => (r.environments as string[]).join(", "),
            },
            {
              key: "manage",
              label: "Manage",
              render: (r) => (
                <div className="row wrap">
                  <Button
                    onClick={() =>
                      request(
                        r as unknown as CompanySummary,
                        "entitlements",
                        [
                          {
                            key: "modules",
                            label: "Entitled modules",
                            type: "multi",
                            options: moduleOptions.map(([id, name]) => [
                              id,
                              `${id} · ${name}`,
                            ]),
                          },
                        ],
                        { modules: r.entitlements as Json },
                      )
                    }
                  >
                    Entitlements
                  </Button>
                  <Button
                    disabled={r.status === "Onboarding"}
                    onClick={() =>
                      request(
                        r as unknown as CompanySummary,
                        "status",
                        [
                          {
                            key: "status",
                            label: "Company status",
                            type: "select",
                            options: ["Active", "Suspended"],
                          },
                        ],
                        { status: r.status as Json },
                      )
                    }
                  >
                    Change status
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Provisioning review queue"
        sub="Ready for provisioning means reviewed; it does not mean deployed."
      >
        {companies.flatMap((company) =>
          company.provisioning.map((ticket) => (
            <div className="company-override" key={ticket.id}>
              <div>
                <strong>
                  {company.name} · {str(ticket.kind)}
                </strong>
                <p>{str(ticket.reason)}</p>
                <Badge value={ticket.status} />
              </div>
              <Button
                onClick={() =>
                  request(
                    company,
                    "provisioning",
                    [
                      {
                        key: "status",
                        label: "Review outcome",
                        type: "select",
                        options: ["Ready for provisioning", "Rejected"],
                        required: true,
                      },
                      {
                        key: "requestId",
                        label: "Request",
                        type: "select",
                        options: [[ticket.id, str(ticket.kind)]],
                        required: true,
                      },
                    ],
                    { requestId: ticket.id, status: "Ready for provisioning" },
                  )
                }
              >
                Review request
              </Button>
            </div>
          )),
        )}
        {!companies.some((c) => c.provisioning.length) && (
          <p>No provisioning requests awaiting review.</p>
        )}
      </Panel>
    </div>
  );
}
