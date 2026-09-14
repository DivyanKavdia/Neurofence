import { arr, str } from "@neurofence/contracts/types";
import { useConsole } from "./ConsoleContext";
import { Button } from "../components/Button";
import { Empty } from "../components/feedback";
import { navigation } from "./navigation";
import { budgetSpend } from "@neurofence/contracts/ledger";
import { num } from "@neurofence/contracts/types";

export function ActionQueue() {
  const ctx = useConsole();
  const items = [
    ...(ctx.state.company?.administration?.draft?.status === "Pending" &&
    arr(ctx.state.settings.notifications).includes("Approval requests")
      ? [
          {
            id: "company-review",
            name: "Company configuration review",
            detail: ctx.state.company.administration.draft.reason,
            page: "company",
            tab: "Configuration",
          },
        ]
      : []),
    ...ctx.state.data.budgets
      .filter(
        (b) =>
          arr(ctx.state.settings.notifications).includes("Budget alerts") &&
          b.status === "Active" &&
          budgetSpend(ctx.state, b) >=
            (num(b.limit) * num(b.threshold, 80)) / 100,
      )
      .map((b) => ({
        id: `budget-${b.id}`,
        name: str(b.name),
        detail: "Budget alert threshold reached",
        page: "budgets",
        tab: "Budget hierarchy",
      })),
    ...ctx.state.data.approvals
      .filter(
        (r) =>
          r.status === "Pending" &&
          arr(ctx.state.settings.notifications).includes("Approval requests"),
      )
      .map((r) => ({
        id: r.id,
        name: str(r.name),
        detail: "Approval requested",
        page: "governance",
        tab: "Approvals",
      })),
    ...ctx.state.data.incidents
      .filter(
        (r) =>
          ["Open", "Investigating"].includes(str(r.status)) &&
          arr(ctx.state.settings.notifications).includes("Security incidents"),
      )
      .map((r) => ({
        id: r.id,
        name: str(r.title),
        detail: `${r.severity} incident`,
        page: "incidents",
        tab: "",
      })),
    ...ctx.state.data.jobs
      .filter((r) => r.status === "Running")
      .map((r) => ({
        id: r.id,
        name: str(r.resource),
        detail: "Sample job running",
        page: "assurance",
        tab: r.collection === "scans" ? "Supply chain" : "Red team",
      })),
  ];
  return (
    <>
      <h2>Workspace action queue</h2>
      <p>Pending work in your current role, workspace and time range.</p>
      {!items.length ? (
        <Empty
          title="No pending work"
          text="New approvals, incidents and running jobs appear here."
        />
      ) : (
        <div className="stack">
          {items.map((item) => (
            <div className="row between wrap" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.detail}</p>
              </div>
              <Button
                onClick={() => {
                  ctx.close();
                  ctx.go(item.page, item.tab, item.id);
                }}
              >
                Review
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function WorkspaceHelp() {
  const ctx = useConsole(),
    nav = navigation.find((n) => n.id === ctx.page);
  const help: Record<string, string> = {
    company:
      "Manage company memberships and teams, then configure defaults and scoped overrides. Save, validate and submit a draft; switch to an independent reviewer to approve it, then publish as a company admin. Operator preview manages onboarding and provisioning requests.",
    inventory:
      "Import a normalized inventory file, preview the changes, then assign ownership and review the four risk contributors. Use Relationships to follow linked assets.",
    gateway:
      "Register and validate a provider, approve its models, publish a route, then bind an application to its policy and budget. Issue a demo credential before using the playground.",
    agents:
      "Register an agent and request its tools, models and delegates. Approve tool permissions as a security administrator. Start a workflow and inspect the complete authority chain before reviewing a sensitive action.",
    budgets:
      "Set budget limits and threshold actions. To add external usage, publish an effective price, preview the normalized import, then reconcile any invoice differences with a reason.",
    governance:
      "Review approvals independently from the requester. Place holds on retained evidence, preview retention actions and map controls to evidence. Policy bundles require acknowledgement before execution resumes.",
    assurance:
      "Run a campaign or scan, inspect the findings, link remediation and retest. Changes to artifact provenance block release. Scheduled sample runs advance while the console polls.",
    guardrails:
      "Create a policy draft, order its detectors, simulate sample inputs and responses, then submit it for independent review. Dictionary detectors use literal terms and selected stages.",
    workforce:
      "Review AI activity by account instance, action and device. Apply coaching or blocking policies and use scoped exceptions when business justification requires review.",
    incidents:
      "Open an incident, assign an owner, examine its trace and contain the affected resource. Record the resolution reason or reopen it for further investigation.",
  };
  return (
    <>
      <h2>{nav?.label || "Workspace"} help</h2>
      <p>
        {help[ctx.page] ||
          "Use the command center to locate unprotected assets, pending approvals and budget issues. Select a module to work through its controls."}
      </p>
      <p>
        Forms retain your entries when validation fails. Refresh a record after
        a conflicting edit. Role preview changes which records and actions are
        available.
      </p>
      <div className="stack">
        {navigation
          .filter((n) => arr(ctx.state.settings.modules).includes(n.module))
          .map((n) => (
            <Button
              key={n.id}
              onClick={() => {
                ctx.close();
                ctx.go(n.id);
              }}
            >
              {n.label}
            </Button>
          ))}
      </div>
    </>
  );
}
