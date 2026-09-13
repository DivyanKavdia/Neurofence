import { Json, Row } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { FormDialog } from "../../components/dialogs";
import { Field } from "../../components/Fields";

export function OperationForm({
  title,
  sub,
  command,
  fields,
  initial,
  row,
  transform,
  done,
}: {
  title: string;
  sub?: string;
  command: string;
  fields: Field[];
  initial?: Record<string, Json>;
  row?: Row;
  transform?: (body: Record<string, Json>) => Record<string, Json>;
  done?: (result: Row) => void;
}) {
  const ctx = useConsole();
  return (
    <FormDialog
      title={title}
      sub={sub}
      fields={fields}
      initial={initial}
      onSubmit={async (body) => {
        const result = await ctx.mutate<Row>(
          command.startsWith("/") ? command : `/api/v1/operations/${command}`,
          transform ? transform(body) : body,
          row,
        );
        ctx.close();
        done?.(result);
      }}
    />
  );
}
