import { Session, users } from "@neurofence/contracts/types";
import { FormDialog } from "../components/dialogs";
import { useConsole } from "./ConsoleContext";

export function SessionDialog() {
  const ctx = useConsole();
  const names =
    ctx.session.role === "Security admin"
      ? ["Mira Kapoor", "Arjun Rao"]
      : ctx.session.role === "Platform admin"
        ? ["Divyan Kavdia", "Platform reviewer"]
        : [users[ctx.session.role]];
  return (
    <FormDialog
      title="Workspace and profile"
      sub="Switch isolated demo workspaces or preview an independent reviewer."
      fields={[
        {
          key: "tenant",
          label: "Workspace",
          type: "select",
          options: [
            ["acme", "Acme Financial"],
            ["northstar", "Northstar Labs"],
          ],
        },
        {
          key: "environment",
          label: "Environment",
          type: "select",
          options: ["Development", "Staging", "Production"],
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
      onSubmit={async (body) =>
        ctx.setSession({ ...ctx.session, ...body } as Session)
      }
    />
  );
}
