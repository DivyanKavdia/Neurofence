import { Session, users } from "@neurofence/contracts/types";
import { FormDialog } from "../components/dialogs";
import { useConsole } from "./ConsoleContext";

export function SessionDialog() {
  const ctx = useConsole();
  const names =
    ctx.session.role === "Neurofence operator"
      ? [users[ctx.session.role]]
      : ctx.state.company?.identities
          .filter((m) => m.roles.includes(ctx.session.role))
          .map((m) => m.name) || [users[ctx.session.role]];
  return (
    <FormDialog
      title="Workspace and profile"
      sub="Switch isolated demo workspaces or preview an independent reviewer."
      fields={[
        {
          key: "tenant",
          label: "Workspace",
          type: "select",
          options:
            ctx.state.company?.companies.map((c) => [c.id, c.name]) || [],
        },
        {
          key: "environment",
          label: "Environment",
          type: "select",
          options: ctx.state.company?.summary.environments || ["Development"],
        },
        {
          key: "region",
          label: "Region context",
          type: "select",
          options: ["India", "Global"],
        },
        { key: "user", label: "Demo identity", type: "select", options: names },
      ]}
      initial={ctx.session}
      submit="Switch context"
      onSubmit={async (body) => {
        const company = ctx.state.company?.companies.find(
          (c) => c.id === body.tenant,
        );
        const environment = company?.environments.includes(
          String(body.environment),
        )
          ? String(body.environment)
          : company?.environments[0] || "Development";
        ctx.setSession({ ...ctx.session, ...body, environment } as Session);
      }}
    />
  );
}
