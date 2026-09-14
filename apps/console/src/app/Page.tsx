import { Discovery } from "../features/inventory/Discovery";
import { CompanyAdmin } from "../features/company/CompanyAdmin";
import { People } from "../features/company/People";
import { FinOpsOperations } from "../features/finops/FinOpsOperations";
import { EvidenceLifecycle } from "../features/governance/EvidenceLifecycle";
import { PolicyDistribution } from "../features/governance/PolicyDistribution";
import { AgentWorkflows } from "../features/agents/AgentWorkflows";
import { AssuranceOperations } from "../features/assurance/AssuranceOperations";
import { str } from "@neurofence/contracts/types";
import { DataTable } from "../components/DataTable";
import { Empty } from "../components/feedback";
import { Panel, Stats } from "../components/layout";
import { Catalog } from "../features/catalog/Catalog";
import { RelationshipView } from "../features/catalog/RelationshipView";
import { RouteCanvas } from "../features/catalog/RouteCanvas";
import { BudgetTree } from "../features/finops/BudgetTree";
import { FinOps } from "../features/finops/FinOps";
import { GatewayOverview } from "../features/gateway/GatewayOverview";
import { Playground } from "../features/gateway/Playground";
import { Approvals } from "../features/governance/Approvals";
import { Compliance } from "../features/governance/Compliance";
import { RoleMatrix } from "../features/governance/RoleMatrix";
import { Settings } from "../features/governance/Settings";
import { Detectors } from "../features/guardrails/Detectors";
import { Simulator } from "../features/guardrails/Simulator";
import { Incidents } from "../features/incidents/Incidents";
import { Overview } from "../features/overview/Overview";
import { Traces } from "../features/traces/Traces";
import { Workforce } from "../features/workforce/Workforce";
import { date } from "../lib/format";
import { useConsole } from "./ConsoleContext";

export function Page({ focusId }: { focusId?: string }) {
  const ctx = useConsole(),
    { page, tab, state } = ctx;
  switch (page) {
    case "company":
      return <CompanyAdmin />;
    case "overview":
      return <Overview />;
    case "inventory":
      if (tab === "Discovery & risk") return <Discovery />;
      return tab === "Relationships" ? (
        <div className="stack">
          {state.data.assets.slice(0, 8).map((row) => (
            <RelationshipView key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <Catalog
          collection="assets"
          title="AI inventory"
          sub="Ownership, lifecycle, risk and control coverage across your AI estate."
          columns={["name", "type", "owner", "risk", "coverage", "status"]}
        />
      );
    case "workforce":
      return tab === "Policies" ? (
        <Catalog
          collection="workforcePolicies"
          title="Activity policies"
          sub="Control visits, prompts, pastes, uploads and downloads by account instance."
          columns={["name", "instance", "activity", "action", "status"]}
        />
      ) : (
        <Workforce />
      );
    case "gateway":
      if (tab === "Providers & models")
        return (
          <Catalog
            collection="providers"
            title="Native providers"
            sub="Connect → validate → discover → approve → publish."
            columns={["name", "type", "region", "status"]}
          />
        );
      if (tab === "Model catalog")
        return (
          <Catalog
            collection="models"
            title="Model deployments"
            sub="Approved capabilities, locality and sample pricing."
            columns={[
              "name",
              "provider",
              "region",
              "capabilities",
              "inputRate",
              "outputRate",
              "status",
            ]}
          />
        );
      if (tab === "Routes")
        return (
          <>
            <Catalog
              collection="routes"
              title="Versioned routes"
              sub="Published routes keep policy, provider eligibility and fallback decisions together."
              columns={[
                "name",
                "alias",
                "primary",
                "fallback",
                "version",
                "status",
              ]}
            />
            {state.data.routes[0] && <RouteCanvas row={state.data.routes[0]} />}
          </>
        );
      if (tab === "Applications & keys")
        return (
          <Catalog
            collection="projects"
            title="Applications & virtual keys"
            sub="Choose the route, guardrail and budget before issuing a virtual credential."
            columns={[
              "name",
              "owner",
              "route",
              "policy",
              "budget",
              "keyStatus",
              "status",
            ]}
          />
        );
      if (tab === "Traces") return <Traces kind="model" />;
      if (tab === "Playground")
        return <Playground kind="model" focusId={focusId} />;
      return <GatewayOverview />;
    case "guardrails":
      if (tab === "Policy builder")
        return (
          <Catalog
            collection="policies"
            title="Guardrail policy library"
            sub="Request and response pipelines with review, impact simulation, canary and rollback."
            columns={[
              "name",
              "mode",
              "pii",
              "responseAction",
              "streaming",
              "version",
              "status",
            ]}
          />
        );
      if (tab === "Simulator") return <Simulator />;
      if (tab === "Detectors") return <Detectors />;
      return (
        <>
          <Stats
            items={[
              {
                label: "Active detectors",
                value: state.data.detectors.filter((d) => d.status === "Active")
                  .length,
                detail: "Request and response inspection",
                go: () => ctx.go("guardrails", "Detectors"),
              },
              {
                label: "Blocked requests",
                value: state.data.traces.filter((t) => t.decision === "DENY")
                  .length,
                detail: "Open the correlated traces",
                go: () => ctx.go("gateway", "Traces"),
              },
              {
                label: "Redacted requests",
                value: state.data.traces.filter((t) => t.decision === "REDACT")
                  .length,
                detail: "Sensitive data transformations",
                go: () => ctx.go("gateway", "Traces"),
              },
              {
                label: "Published policies",
                value: state.data.policies.filter((p) =>
                  ["Active", "Canary"].includes(str(p.status)),
                ).length,
                detail: "Versioned deterministic decisions",
                go: () => ctx.go("guardrails", "Policy builder"),
              },
            ]}
          />
          <Detectors />
        </>
      );
    case "agents":
      if (tab === "Workflows & delegation") return <AgentWorkflows />;
      if (tab === "Agents")
        return (
          <Catalog
            collection="agents"
            title="Agent inventory"
            sub="Purpose, identity, tool authority, data scope and workflow limits."
            columns={[
              "name",
              "owner",
              "purpose",
              "project",
              "maxSteps",
              "status",
            ]}
          />
        );
      if (tab === "MCP catalog")
        return (
          <Catalog
            collection="servers"
            title="MCP servers"
            sub="Register endpoints, discover capabilities and review their provenance."
            columns={["name", "transport", "auth", "owner", "status"]}
          />
        );
      if (tab === "Tool permissions")
        return (
          <Catalog
            collection="tools"
            title="Tool permissions"
            sub="Authorize action classes, argument schemas, resource scopes and expiry."
            columns={["name", "action", "scope", "risk", "status"]}
          />
        );
      if (tab === "Tool playground")
        return <Playground kind="tool" focusId={focusId} />;
      return <Traces kind="tool" />;
    case "budgets":
      if (tab === "Prices & reconciliation") return <FinOpsOperations />;
      if (tab === "Budget hierarchy") return <BudgetTree />;
      if (tab === "Usage ledger") return <Traces />;
      return <FinOps forecast={tab === "Forecast & anomalies"} />;
    case "incidents":
      return <Incidents />;
    case "assurance":
      if (tab === "Schedules & provenance") return <AssuranceOperations />;
      return (
        <Catalog
          collection={tab === "Supply chain" ? "scans" : "campaigns"}
          title={
            tab === "Supply chain"
              ? "Supply-chain assurance"
              : "Red-team campaigns"
          }
          sub="Run a sample job, investigate findings, link remediation and verify the release gate."
          columns={
            tab === "Supply chain"
              ? ["name", "target", "artifact", "provenance", "gate", "status"]
              : ["name", "target", "pack", "schedule", "gate", "status"]
          }
        />
      );
    case "governance":
      if (tab === "Evidence lifecycle") return <EvidenceLifecycle />;
      if (tab === "Policy distribution") return <PolicyDistribution />;
      if (tab === "Approvals") return <Approvals />;
      if (tab === "Exceptions")
        return (
          <Catalog
            collection="exceptions"
            title="Scoped exceptions"
            sub="Time-bound business justification with independent review."
            columns={["name", "resource", "scope", "reason", "status"]}
          />
        );
      if (tab === "Evidence & compliance") return <Compliance />;
      if (tab === "Audit trail")
        return (
          <Panel
            title="Audit trail"
            sub="Every simulated administrative change records its actor, reason and related resource."
          >
            <DataTable
              name="Audit events"
              rows={state.data.audit}
              columns={[
                { key: "ts", label: "Time", render: (r) => date(r.ts) },
                { key: "actor", label: "Actor" },
                { key: "event", label: "Event" },
                { key: "detail", label: "Details" },
                { key: "reference", label: "Reference" },
              ]}
            />
          </Panel>
        );
      if (tab === "Integrations")
        return (
          <Catalog
            collection="integrations"
            title="Integrations"
            sub="Configure secret references and exercise connection validation. Test deliveries are simulated."
            columns={["name", "type", "endpoint", "status"]}
          />
        );
      if (tab === "Members")
        return state.company?.administration ? (
          <People company={state.company.administration} />
        ) : (
          <Panel title="Company memberships">
            <p>
              Memberships are managed by a company administrator across all
              environments.
            </p>
          </Panel>
        );
      if (tab === "Settings") return <Settings />;
      return <RoleMatrix />;
    default:
      return <Empty />;
  }
}
