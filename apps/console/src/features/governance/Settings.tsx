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
      <FormDialog
        title="Workspace settings"
        fields={[
          { key: "name", label: "Workspace name", required: true },
          {
            key: "deployment",
            label: "Deployment profile",
            type: "select",
            options: ["SaaS", "Private cloud", "On-premises", "Air-gapped"],
          },
          {
            key: "residency",
            label: "Data residency",
            type: "select",
            options: ["India", "Any region"],
          },
          {
            key: "retention",
            label: "Evidence privacy",
            type: "select",
            options: ["Metadata only", "Redacted content", "Full content"],
          },
          {
            key: "days",
            label: "Retention days",
            type: "number",
            min: 1,
            max: 3650,
          },
          {
            key: "fourEyes",
            label: "Require independent approval",
            type: "checkbox",
          },
          {
            key: "rawContent",
            label: "Explicitly retain content for future demo traces",
            type: "checkbox",
          },
          {
            key: "density",
            label: "Display density",
            type: "select",
            options: ["Comfortable", "Compact"],
          },
          {
            key: "controlPlane",
            label: "Control-plane scenario",
            type: "select",
            options: ["Healthy", "Unavailable"],
          },
          {
            key: "modules",
            label: "Enabled modules",
            type: "multi",
            options: [
              ["M1", "M1 · Inventory"],
              ["M2", "M2 · Workforce"],
              ["M3", "M3 · Guardrails"],
              ["M4", "M4 · Gateway"],
              ["M5", "M5 · Agent & MCP"],
              ["M6", "M6 · FinOps"],
              ["M7", "M7 · Red team"],
              ["M8", "M8 · Supply chain"],
              ["M9", "M9 · Governance"],
            ],
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
