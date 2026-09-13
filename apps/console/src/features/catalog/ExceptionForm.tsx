import { useConsole } from "../../app/ConsoleContext";
import { FormDialog } from "../../components/dialogs";
import { fieldsFor } from "./fields";

export function ExceptionForm({ resource }: { resource: string }) {
  const ctx = useConsole();
  return (
    <FormDialog
      title="Request a scoped exception"
      fields={fieldsFor("exceptions", ctx.state, ctx.session.user)}
      initial={{ resource, name: "Temporary exception" }}
      submit="Request review"
      onSubmit={async (body) => {
        await ctx.mutate("/api/v1/exceptions", body);
        ctx.close();
        ctx.notify("Exception sent to the demo approval queue.");
      }}
    />
  );
}
