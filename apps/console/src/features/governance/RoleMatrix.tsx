import { capabilities, roles } from "@neurofence/contracts/types";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/feedback";
import { Panel } from "../../components/layout";

export function RoleMatrix() {
  return (
    <Panel
      title="Role and capability matrix"
      sub="Write capabilities are checked by the mock API as well as the interface."
    >
      <DataTable
        name="Role permissions"
        rows={roles.map((role) => ({
          id: role,
          version: 1,
          name: role,
          capabilities: Object.keys(capabilities)
            .filter((c) => capabilities[c].includes(role))
            .join(", "),
          scope: ["Developer", "Agent owner"].includes(role)
            ? "Own applications and agents"
            : "Workspace",
          content: ["Security admin", "SOC analyst"].includes(role)
            ? "Separate audited permission"
            : "Metadata only",
        }))}
        columns={[
          { key: "name", label: "Role" },
          { key: "capabilities", label: "Write capabilities" },
          { key: "scope", label: "Scope" },
          { key: "content", label: "Content access" },
        ]}
      />
      <Notice>
        Role preview is a demo mechanism. Production authentication must resolve
        identity and capabilities from the server session.
      </Notice>
    </Panel>
  );
}
