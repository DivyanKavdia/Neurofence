import { Collection, Json, obj, Row } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { FormDialog } from "../../components/dialogs";
import { fieldsFor } from "./fields";
import { labels } from "./labels";
import { ResourceDetail } from "./ResourceDetail";

export function Editor({
  collection,
  id,
}: {
  collection: Collection;
  id?: string;
}) {
  const ctx = useConsole(),
    record = ctx.state.data[collection].find((r) => r.id === id),
    config = ["policies", "routes", "budgets"].includes(collection);
  const fields = fieldsFor(collection, ctx.state, ctx.session.user),
    initial = record
      ? (Object.fromEntries(
          fields.map((f) => [
            f.key,
            obj(record.draft)[f.key] ?? record[f.key] ?? f.default ?? "",
          ]),
        ) as Record<string, Json>)
      : {};
  return (
    <FormDialog
      title={`${id ? "Edit" : "Create"} ${labels[collection] || collection}`}
      sub={
        config
          ? "Save a new draft, simulate the impact, obtain review and publish."
          : ""
      }
      fields={fields}
      initial={initial}
      submit={config ? "Save draft" : "Save"}
      onSubmit={async (body) => {
        const row = await ctx.mutate<Row>(
          `/api/v1/${collection}${id ? `/${id}${config ? "/draft" : ""}` : ""}`,
          body,
          record,
          id && !config ? "PATCH" : "POST",
        );
        ctx.open(<ResourceDetail collection={collection} id={row.id} />);
      }}
    />
  );
}
