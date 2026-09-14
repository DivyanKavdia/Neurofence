import { Company } from "@neurofence/contracts/company";
import { capabilities, Role, roles } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { FormDialog } from "../../components/dialogs";
import { Panel } from "../../components/layout";

export function RolePermissions({ company }: { company: Company }) {
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
