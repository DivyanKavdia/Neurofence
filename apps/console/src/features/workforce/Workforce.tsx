import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { FormDialog } from "../../components/dialogs";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { WorkforceDetail } from "./WorkforceDetail";

export function Workforce() {
  const ctx = useConsole();
  return (
    <Panel
      title="Workforce AI activity"
      sub="Understand the person, device, account instance and data activity behind each event."
      actions={
        <Button
          cap="workforce"
          onClick={() =>
            ctx.open(
              <FormDialog
                title="Simulate workforce activity"
                fields={[
                  {
                    key: "name",
                    label: "Activity name",
                    default: "Sample workforce event",
                    required: true,
                  },
                  {
                    key: "app",
                    label: "AI application",
                    default: "ChatGPT",
                    required: true,
                  },
                  {
                    key: "user",
                    label: "User",
                    default: "Neha Singh",
                    required: true,
                  },
                  {
                    key: "instance",
                    label: "Account instance",
                    type: "select",
                    options: [
                      "Personal account",
                      "Enterprise tenant",
                      "Unknown account",
                    ],
                    default: "Personal account",
                  },
                  {
                    key: "activity",
                    label: "Activity",
                    type: "select",
                    options: [
                      "Visit",
                      "Prompt",
                      "Paste",
                      "File upload",
                      "Download",
                    ],
                    default: "File upload",
                  },
                  {
                    key: "classification",
                    label: "Data classification",
                    default: "Customer identifiers",
                  },
                  { key: "device", label: "Device", default: "Managed laptop" },
                ]}
                submit="Simulate event"
                onSubmit={async (body) => {
                  await ctx.mutate("/api/v1/workforce", body);
                  ctx.close();
                }}
              />,
            )
          }
        >
          Simulate activity
        </Button>
      }
    >
      <DataTable
        name="Workforce activity"
        rows={ctx.state.data.workforce}
        columns={[
          { key: "app", label: "Application" },
          { key: "instance", label: "Account" },
          { key: "user", label: "User" },
          { key: "activity", label: "Activity" },
          { key: "classification", label: "Data" },
          {
            key: "action",
            label: "Outcome",
            render: (r) => <Badge value={r.action} />,
          },
        ]}
        onOpen={(r) => ctx.open(<WorkforceDetail id={r.id} />)}
      />
    </Panel>
  );
}
