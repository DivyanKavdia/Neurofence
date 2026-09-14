import { useEffect, useState } from "react";
import {
  Company,
  CompanySummary,
  moduleOptions,
} from "@neurofence/contracts/company";
import {
  capabilities,
  Json,
  Role,
  roles,
  Row,
  str,
} from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Confirm, FormDialog } from "../../components/dialogs";
import { Badge, Notice } from "../../components/feedback";
import { Panel, Stats } from "../../components/layout";
import { date } from "../../lib/format";
import { OperationForm } from "../operations/OperationForm";
import { Configuration } from "./Configuration";
import { Onboarding } from "./Onboarding";
import { People } from "./People";

export function CompanyAdmin() {
  const ctx = useConsole();
  if (ctx.session.role === "Neurofence operator") return <OperatorCompanies />;
  const company = ctx.state.company?.administration;
  if (!company)
    return (
      <Panel
        title="Your company"
        sub="Contact a company administrator to change organization settings."
      >
        <p>{ctx.state.company?.summary.name}</p>
        <p>Your role: {ctx.session.role}</p>
        <p>Published configuration: v{ctx.state.company?.effective.version}</p>
      </Panel>
    );
  const row = { id: company.id, version: company.version };
  if (ctx.tab === "People & teams") return <People company={company} />;
  if (ctx.tab === "Configuration") return <Configuration company={company} />;
  if (ctx.tab === "Access & identity")
    return (
      <div className="stack">
        <RolePermissions company={company} />
        <Configuration company={company} identity />
      </div>
    );
  if (ctx.tab === "History & audit")
    return (
      <div className="stack">
        <Panel
          title="Configuration history"
          sub="Restoring an earlier version creates a new draft for independent review."
        >
          <DataTable
            name="Company configuration history"
            rows={
              company.history.map((h) => ({
                ...h,
                id: `revision-${h.version}`,
              })) as unknown as Row[]
            }
            columns={[
              { key: "version", label: "Version" },
              {
                key: "publishedAt",
                label: "Published",
                render: (r) => date(r.publishedAt),
              },
              { key: "publishedBy", label: "Published by" },
              { key: "reason", label: "Reason" },
              {
                key: "restore",
                label: "Restore",
                render: (r) => (
                  <Button
                    cap="company"
                    disabled={r.version === company.publishedVersion}
                    onClick={() =>
                      ctx.open(
                        <Confirm
                          title={`Restore company version ${r.version}`}
                          description="This creates a rollback draft. Validate, review and publish it to apply the earlier values."
                          verb="Create rollback draft"
                          onConfirm={async (reason) => {
                            await ctx.mutate(
                              "/api/v1/company/config/rollback",
                              { targetVersion: r.version, reason },
                              row,
                            );
                            ctx.go("company", "Configuration");
                          }}
                        />,
                      )
                    }
                  >
                    Restore version
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
        <Panel
          title="Company audit trail"
          sub="Company changes are recorded once, across all environments."
        >
          <DataTable
            name="Company audit trail"
            rows={company.audit}
            columns={[
              { key: "ts", label: "Time", render: (r) => date(r.ts) },
              { key: "actor", label: "Actor" },
              { key: "event", label: "Event" },
              { key: "detail", label: "Details" },
            ]}
          />
        </Panel>
      </div>
    );
  if (ctx.tab === "Provisioning")
    return (
      <Panel
        title="Provisioning requests"
        sub="Track changes that require an operator and infrastructure work. A request never applies Terraform."
        actions={
          <Button
            cap="company"
            primary
            onClick={() =>
              ctx.open(
                <OperationForm
                  title="Request provisioning"
                  command="/api/v1/company/provisioning"
                  row={row}
                  fields={[
                    {
                      key: "kind",
                      label: "Request type",
                      type: "select",
                      options: [
                        "Dedicated deployment",
                        "Residency migration",
                        "Identity connection",
                        "Notification delivery",
                      ],
                      required: true,
                    },
                    {
                      key: "reason",
                      label: "Request details",
                      type: "textarea",
                      required: true,
                    },
                  ]}
                />,
              )
            }
          >
            New provisioning request
          </Button>
        }
      >
        <DataTable
          name="Company provisioning"
          rows={company.provisioning}
          columns={[
            { key: "kind", label: "Request" },
            { key: "environment", label: "Environment" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge value={r.status} />,
            },
            { key: "reason", label: "Details" },
            { key: "reviewReason", label: "Operator review" },
          ]}
        />
      </Panel>
    );
  const reviewers = company.members.filter(
    (m) =>
      m.status === "Active" &&
      m.roles.some((r) => r === "Security admin" || r === "Company admin"),
  );
  return (
    <div className="stack">
      <div className="company-hero">
        <div>
          <div className="eyebrow">Company administration</div>
          <h2>{company.name}</h2>
          <p>
            Set the defaults. Delegate ownership. Keep every environment
            governed.
          </p>
        </div>
        <Badge value={company.status} />
      </div>
      <Stats
        items={[
          {
            label: "Active members",
            value: company.members.filter((m) => m.status === "Active").length,
            detail: "Company-wide access",
            go: () => ctx.go("company", "People & teams"),
          },
          {
            label: "Teams",
            value: company.teams.length,
            detail: "Departments and cost centers",
            go: () => ctx.go("company", "People & teams"),
          },
          {
            label: "Environments",
            value: company.environments.length,
            detail: company.environments.join(", "),
          },
          {
            label: "Published configuration",
            value: `v${company.publishedVersion}`,
            detail: company.draft
              ? `${company.draft.status} changes pending`
              : "All settings published",
            go: () => ctx.go("company", "Configuration"),
          },
        ]}
      />
      <Panel
        title={
          company.status === "Onboarding"
            ? "Finish company setup"
            : "Company setup"
        }
        sub="These steps prepare administrators and the governed application experience."
      >
        <div className="company-checklist">
          {[
            {
              name: "Company and first administrator",
              done: true,
              detail: "Company identity and initial ownership are registered.",
              tab: "Configuration",
            },
            {
              name: "Independent reviewer",
              done: reviewers.length >= 2,
              detail:
                "Activate another company admin or security administrator.",
              tab: "People & teams",
            },
            {
              name: "Company defaults",
              done: !company.draft,
              detail:
                "Review modules, security controls and application limits.",
              tab: "Configuration",
            },
            {
              name: "Identity and delegated access",
              done: !!company.config.values.issuer,
              detail:
                "Configure your IdP connection and role templates when ready.",
              tab: "Access & identity",
            },
          ].map((check) => (
            <button
              key={check.name}
              onClick={() => ctx.go("company", check.tab)}
            >
              <span className={`company-check ${check.done ? "done" : ""}`}>
                {check.done ? "✓" : "○"}
              </span>
              <span>
                <strong>{check.name}</strong>
                <small>{check.detail}</small>
              </span>
              <span>→</span>
            </button>
          ))}
        </div>
        {company.status === "Onboarding" && (
          <Button
            cap="company"
            primary
            onClick={() =>
              void ctx
                .mutate("/api/v1/company/activate", {}, row)
                .catch(() => {})
            }
          >
            Complete company onboarding
          </Button>
        )}
      </Panel>
      <Panel
        title="Environments and application setup"
        sub="Each environment has isolated application data and inherits published company defaults."
      >
        <div className="row wrap">
          {company.environments.map((environment) => (
            <Button
              key={environment}
              onClick={() => ctx.setSession({ ...ctx.session, environment })}
            >
              {environment}
              {environment === ctx.session.environment ? " · current" : ""}
            </Button>
          ))}
        </div>
        <div className="row wrap company-panel-actions">
          <Button
            cap="company"
            onClick={() =>
              ctx.open(
                <OperationForm
                  title="Add company environment"
                  command="/api/v1/company/environments"
                  row={row}
                  fields={[
                    { key: "name", label: "Environment name", required: true },
                  ]}
                />,
              )
            }
          >
            Add environment
          </Button>
          <Button
            cap="company"
            disabled={
              ctx.state.data.projects.length > 0 ||
              ctx.state.settings.modelRuntime !== "mock"
            }
            onClick={() =>
              ctx.open(
                <Confirm
                  title="Create starter applications"
                  description="Add dummy providers, published guardrails, routes, budgets and applications to this empty environment."
                  verb="Create starter resources"
                  onConfirm={async () => {
                    await ctx.mutate("/api/v1/company/starter", {}, row);
                    ctx.close();
                  }}
                />,
              )
            }
          >
            Create demo application
          </Button>
          <Button onClick={() => ctx.go("gateway", "Providers & models")}>
            Manage provider connections
          </Button>
          <Button onClick={() => ctx.go("governance", "Integrations")}>
            Manage integrations
          </Button>
        </div>
        <Notice>
          Membership, configuration and approvals work in the dummy backend.
          External identity verification, invitation delivery and cloud
          provisioning use the production integration points.
        </Notice>
      </Panel>
    </div>
  );
}

function RolePermissions({ company }: { company: Company }) {
  const ctx = useConsole(),
    config = company.draft || company.config;
  const templates = roles.filter(
    (r) => !["Company admin", "Neurofence operator"].includes(r),
  );
  const editRole = (role: Role) => {
    const available = Object.entries(capabilities)
      .filter(([, assigned]) => assigned.includes(role))
      .map(([cap]) => cap);
    ctx.open(
      <FormDialog
        title={`Configure ${role.toLowerCase()} permissions`}
        sub="Narrow the built-in role template. Assigned members receive these permissions after publication."
        fields={[
          {
            key: "permissions",
            label: "Allowed capabilities",
            type: "multi",
            options: available,
          },
          {
            key: "reason",
            label: "Change reason",
            type: "textarea",
            required: true,
          },
        ]}
        initial={{ permissions: config.rolePermissions[role] || available }}
        submit="Save permissions draft"
        onSubmit={async (body) => {
          await ctx.mutate(
            "/api/v1/company/config/draft",
            {
              rolePermissions: {
                ...config.rolePermissions,
                [role]: body.permissions,
              },
              reason: body.reason,
            },
            { id: company.id, version: company.version },
          );
          ctx.close();
        }}
      />,
    );
  };
  return (
    <Panel
      title="Delegated role permissions"
      sub="Company admins manage administration. Specialist roles retain their own permission boundaries, and the backend checks every mutation."
    >
      <DataTable
        name="Company role templates"
        rows={templates.map((role) => ({
          id: role,
          version: 1,
          name: role,
          permissions:
            config.rolePermissions[role] ||
            Object.entries(capabilities)
              .filter(([, assigned]) => assigned.includes(role))
              .map(([cap]) => cap),
        }))}
        columns={[
          { key: "name", label: "Role" },
          {
            key: "permissions",
            label: "Allowed capabilities",
            render: (r) =>
              (r.permissions as string[]).join(", ") || "Read only",
          },
          {
            key: "configure",
            label: "Configure",
            render: (r) => (
              <Button cap="company" onClick={() => editRole(r.name as Role)}>
                Configure permissions
              </Button>
            ),
          },
        ]}
      />
    </Panel>
  );
}

function OperatorCompanies() {
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
