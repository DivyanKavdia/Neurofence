import { arr, num, obj, Row, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Panel } from "../../components/layout";
import { Notice } from "../../components/feedback";
import { resourceOptions } from "../../lib/resource-options";
import { TraceView } from "../traces/TraceView";
import { OperationForm } from "../operations/OperationForm";

export function AgentWorkflows() {
  const ctx = useConsole(),
    d = ctx.state.data;
  const show = (trace: Row) =>
    ctx.open(
      <>
        <h2>Workflow decision</h2>
        <TraceView trace={trace} />
      </>,
    );
  const run = (model: boolean) =>
    ctx.open(
      <OperationForm
        title={model ? "Run agent model call" : "Run delegated tool call"}
        command={`/api/v1/runtime/${model ? "model" : "tool"}`}
        fields={[
          {
            key: "agent",
            label: "Root agent",
            type: "select",
            options: resourceOptions(ctx.state, "agents"),
            required: true,
          },
          ...(model
            ? [
                {
                  key: "prompt",
                  label: "Prompt",
                  type: "textarea" as const,
                  default: "Summarise approved guidance",
                  required: true,
                },
                {
                  key: "maxTokens",
                  label: "Output token limit",
                  type: "number" as const,
                  default: 400,
                  min: 1,
                  required: true,
                },
              ]
            : [
                {
                  key: "delegates",
                  label: "Ordered delegation chain",
                  type: "ordered" as const,
                  options: resourceOptions(ctx.state, "agents"),
                  default: [],
                },
                {
                  key: "tool",
                  label: "Tool",
                  type: "select" as const,
                  options: resourceOptions(ctx.state, "tools"),
                  required: true,
                },
                {
                  key: "args",
                  label: "Exact tool arguments (JSON)",
                  type: "textarea" as const,
                  default: '{"claim_id":"CLAIM-1042"}',
                  required: true,
                },
                {
                  key: "responsePreset",
                  label: "Sample tool result",
                  type: "select" as const,
                  options: [
                    ["safe", "Approved sample"],
                    ["pii", "Sensitive identifier"],
                    ["injection", "Injected instructions"],
                  ] as [string, string][],
                  default: "safe",
                },
              ]),
        ]}
        transform={(body) =>
          model
            ? {
                ...body,
                project: str(
                  d.agents.find((a) => a.id === body.agent)?.project,
                ),
                streaming: false,
              }
            : { ...body, args: JSON.parse(str(body.args)) }
        }
        done={show}
      />,
    );
  const workflows = d.agents.map((agent) => {
    const traces = d.traces.filter((t) => t.workflow === agent.workflow);
    return {
      ...agent,
      cost: traces.reduce((sum, t) => sum + num(t.cost), 0),
      modelCalls: traces.filter(
        (t) => t.kind === "model" && (t.executed || t.pendingCost),
      ).length,
      callCount: traces.length,
    };
  });
  return (
    <div className="stack">
      <Panel
        title="Agent workflows & delegation"
        sub="Model grants, tool grants, resource scope, environment and limits are checked for the participating agents."
        actions={
          <>
            <Button
              cap="run"
              disabled={ctx.state.settings.modelRuntime !== "mock"}
              onClick={() => run(true)}
            >
              Run agent model call
            </Button>
            <Button primary cap="run" onClick={() => run(false)}>
              Run delegated tool call
            </Button>
          </>
        }
      >
        <Notice>
          Grant models and delegates in the agent editor before running.
          Delegation must remain in one application; every participating agent
          must allow the selected tool and resource. Calls use the root
          workflow's cost ledger.
        </Notice>
        <DataTable
          name="Agent workflows"
          rows={workflows}
          columns={[
            { key: "name", label: "Agent" },
            { key: "workflow", label: "Workflow" },
            { key: "stepsUsed", label: "Steps" },
            { key: "modelCalls", label: "Model calls" },
            { key: "cost", label: "Workflow INR" },
            {
              key: "maxCost",
              label: "Cost cap",
              render: (r) => num(r.maxCost, 10),
            },
            {
              key: "allowedDelegates",
              label: "Delegates",
              render: (r) =>
                arr<string>(r.allowedDelegates)
                  .map((id) =>
                    str(d.agents.find((a) => a.id === id)?.name || id),
                  )
                  .join(", ") || "None",
            },
            {
              key: "action",
              label: "Actions",
              render: (row) => (
                <Button
                  cap="agents"
                  onClick={() =>
                    ctx.open(
                      <OperationForm
                        title="Start a new workflow"
                        sub="Counters reset for the new workflow; existing trace costs and evidence remain in the ledger."
                        command={`/api/v1/agents/${row.id}/workflow`}
                        row={row}
                        fields={[]}
                      />,
                    )
                  }
                >
                  New workflow
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Correlated workflow traces"
        sub="Follow the delegation chain and inspect request, result, approval and billing decisions."
      >
        <DataTable
          name="Workflow traces"
          rows={d.traces.filter((t) => t.agent)}
          columns={[
            { key: "workflow", label: "Workflow" },
            { key: "kind", label: "Call" },
            { key: "decision", label: "Decision" },
            {
              key: "delegation",
              label: "Authority chain",
              render: (r) => arr(r.delegation).join(" → "),
            },
            {
              key: "responseFindings",
              label: "Result findings",
              render: (r) =>
                arr(r.responseFindings)
                  .map((f) => str(obj(f).category))
                  .join(", ") || "None",
            },
            { key: "cost", label: "INR" },
          ]}
          onOpen={show}
        />
      </Panel>
    </div>
  );
}
