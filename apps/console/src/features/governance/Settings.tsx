import { Json } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Confirm, FormDialog } from "../../components/dialogs";
import { Notice } from "../../components/feedback";
import { Panel } from "../../components/layout";

export function Settings() {
  const ctx = useConsole(),
    settings = ctx.state.settings;
  return (
    <Panel
      title="Workspace and deployment settings"
      sub="The same workflows are available in every deployment profile."
    >
      <Notice>
        Company profile, privacy, modules and defaults are managed in Company
        administration.
      </Notice>
      <Button onClick={() => ctx.go("company", "Configuration")}>
        Open company configuration
      </Button>
      <FormDialog
        title="Workspace settings"
        fields={[
          {
            key: "deployment",
            label: "Deployment profile",
            type: "select",
            options: ["SaaS", "Private cloud", "On-premises", "Air-gapped"],
          },
          {
            key: "controlPlane",
            label: "Control-plane scenario",
            type: "select",
            options: ["Healthy", "Unavailable"],
          },
        ]}
        initial={settings as Record<string, Json>}
        onSubmit={async (body) => {
          await ctx.mutate("/api/v1/settings", body, settings, "PATCH");
          ctx.notify("Workspace settings saved.");
        }}
        submit="Save settings"
      />
      <Notice>
        Profile, retention and dependency health controls simulate backend
        behavior. Cloud infrastructure is provisioned separately from the
        Terraform configuration.
      </Notice>
      <Button
        cap="settings"
        danger
        onClick={() =>
          ctx.open(
            <Confirm
              title="Reset this demo workspace"
              description="This clears this tenant and environment’s demo records. Other workspaces are preserved."
              verb="Reset demo"
              onConfirm={async () => {
                await ctx.mutate("/api/v1/reset");
                ctx.close();
              }}
            />,
          )
        }
      >
        Reset demo
      </Button>
    </Panel>
  );
}
