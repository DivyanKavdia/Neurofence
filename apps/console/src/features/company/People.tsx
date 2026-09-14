import { Company, Membership } from "@neurofence/contracts/company";
import { Json, roles, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { FormDialog } from "../../components/dialogs";
import { Badge, Notice } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { OperationForm } from "../operations/OperationForm";

export function People({ company }: { company: Company }) {
  const ctx = useConsole(),
    row = { id: company.id, version: company.version };
  const memberForm = (member?: Membership) =>
    ctx.open(
      <FormDialog
        title={member ? "Manage company member" : "Invite company member"}
        sub="Membership applies across this company’s environments. Invitations and activation are simulated."
        fields={[
          { key: "name", label: "Member name", required: true },
          { key: "email", label: "Member email", required: true },
          {
            key: "roles",
            label: "Assigned roles",
            type: "multi",
            options: roles.filter((r) => r !== "Neurofence operator"),
          },
          {
            key: "teams",
            label: "Assigned teams",
            type: "multi",
            options: company.teams.map((t) => [t.id, t.name]),
          },
          ...(member
            ? [
                {
                  key: "status",
                  label: "Membership status",
                  type: "select" as const,
                  options: ["Invited", "Active", "Suspended"],
                },
                {
                  key: "reason",
                  label: "Membership change reason",
                  type: "textarea" as const,
                  required: true,
                },
              ]
            : []),
        ]}
        initial={
          member
            ? JSON.parse(JSON.stringify(member))
            : { roles: ["Developer"], teams: [] }
        }
        submit={member ? "Save membership" : "Create invitation"}
        onSubmit={async (body) => {
          await ctx.mutate(
            `/api/v1/company/members${member ? "/" + member.id : ""}`,
            body,
            row,
            member ? "PATCH" : "POST",
          );
          ctx.close();
        }}
      />,
    );
  return (
    <div className="stack">
      <Panel
        title="Company members"
        sub="Active membership and assigned permissions are checked by the backend for every request."
        actions={
          <Button cap="company" primary onClick={() => memberForm()}>
            Invite member
          </Button>
        }
      >
        <DataTable
          name="Company members"
          rows={company.members}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            {
              key: "roles",
              label: "Roles",
              render: (r) => (r.roles as string[]).join(", "),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge value={r.status} />,
            },
            {
              key: "manage",
              label: "Manage",
              render: (r) => (
                <Button
                  cap="company"
                  onClick={() => memberForm(r as Membership)}
                >
                  Manage
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Teams and departments"
        sub="Group applications and members under a team and cost center."
        actions={
          <Button
            cap="company"
            onClick={() =>
              ctx.open(
                <OperationForm
                  title="Create company team"
                  command="/api/v1/company/teams"
                  row={row}
                  fields={[
                    { key: "name", label: "Team name", required: true },
                    { key: "department", label: "Department", required: true },
                    { key: "costCenter", label: "Cost center", required: true },
                  ]}
                />,
              )
            }
          >
            Create team
          </Button>
        }
      >
        <DataTable
          name="Company teams"
          rows={company.teams}
          columns={[
            { key: "name", label: "Team" },
            { key: "department", label: "Department" },
            { key: "costCenter", label: "Cost center" },
            {
              key: "manage",
              label: "Manage",
              render: (team) => (
                <Button
                  cap="company"
                  onClick={() =>
                    ctx.open(
                      <FormDialog
                        title="Edit company team"
                        fields={[
                          { key: "name", label: "Team name", required: true },
                          {
                            key: "department",
                            label: "Department",
                            required: true,
                          },
                          {
                            key: "costCenter",
                            label: "Cost center",
                            required: true,
                          },
                        ]}
                        initial={team as Record<string, Json>}
                        onSubmit={async (body) => {
                          await ctx.mutate(
                            `/api/v1/company/teams/${team.id}`,
                            body,
                            row,
                            "PATCH",
                          );
                          ctx.close();
                        }}
                      />,
                    )
                  }
                >
                  Edit team
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Application ownership"
        sub={`${ctx.session.environment} applications inherit settings from their assigned team.`}
      >
        <DataTable
          name="Application teams"
          rows={ctx.state.data.projects}
          columns={[
            { key: "name", label: "Application" },
            {
              key: "team",
              label: "Team",
              render: (project) =>
                company.teams.find(
                  (t) =>
                    t.id ===
                    company.projectTeams.find(
                      (p) =>
                        p.environment === ctx.session.environment &&
                        p.project === project.id,
                    )?.team,
                )?.name || "Unassigned",
            },
            {
              key: "assign",
              label: "Assignment",
              render: (project) => (
                <Button
                  cap="company"
                  onClick={() =>
                    ctx.open(
                      <OperationForm
                        title="Assign application to team"
                        command="/api/v1/company/project-teams"
                        row={row}
                        initial={{
                          project: project.id,
                          team:
                            company.projectTeams.find(
                              (p) =>
                                p.environment === ctx.session.environment &&
                                p.project === project.id,
                            )?.team || "",
                        }}
                        fields={[
                          {
                            key: "project",
                            label: "Application",
                            type: "select",
                            options: [[project.id, str(project.name)]],
                            required: true,
                          },
                          {
                            key: "team",
                            label: "Company team",
                            type: "select",
                            options: company.teams.map((t) => [t.id, t.name]),
                            help: "Select an empty value to remove the assignment.",
                          },
                        ]}
                      />,
                    )
                  }
                >
                  Assign team
                </Button>
              ),
            },
          ]}
        />
        <Notice>
          Developers and agent owners can access owned applications and
          applications assigned to their teams. Existing guardrail and approval
          checks still apply.
        </Notice>
      </Panel>
    </div>
  );
}
