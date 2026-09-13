import { str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { FormDialog } from "../../components/dialogs";
import { Details } from "../../components/layout";
import { ExceptionForm } from "../catalog/ExceptionForm";

export function WorkforceDetail({ id }: { id: string }) {
  const ctx = useConsole(),
    r = ctx.state.data.workforce.find((w) => w.id === id)!;
  return (
    <>
      <h2>{str(r.app)} activity</h2>
      <Details
        row={r}
        fields={[
          "user",
          "device",
          "instance",
          "activity",
          "classification",
          "action",
          "reason",
        ]}
      />
      <FormDialog
        title="Review activity control"
        fields={[
          {
            key: "action",
            label: "Outcome",
            type: "select",
            options: ["Allow", "Coach", "Redact", "Block"],
            default: r.action,
          },
          {
            key: "reason",
            label: "Review reason",
            type: "textarea",
            required: true,
          },
        ]}
        onSubmit={async (body) => {
          await ctx.mutate(`/api/v1/workforce/${id}`, body, r, "PATCH");
          ctx.close();
        }}
        submit="Save control"
      />
      <Button
        cap="exceptions"
        onClick={() => ctx.open(<ExceptionForm resource={id} />)}
      >
        Request exception
      </Button>
    </>
  );
}
