import { num, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Badge, Notice } from "../../components/feedback";
import { Panel, Stats } from "../../components/layout";
import { ResourceDetail } from "../catalog/ResourceDetail";
import { Traces } from "../traces/Traces";

export function GatewayOverview() {
  const ctx = useConsole(),
    d = ctx.state.data,
    traces = d.traces.filter((t) => t.kind === "model");
  return (
    <>
      {str(ctx.state.settings.modelRuntime).startsWith("litellm-") && (
        <Notice>
          Model execution:{" "}
          {ctx.state.settings.modelRuntime === "litellm-live"
            ? "live provider through LiteLLM"
            : "LiteLLM test fixture"}
          . Account, catalog and policy controls use prototype data.
        </Notice>
      )}
      <Stats
        items={[
          {
            label: "Model requests",
            value: traces.length,
            detail: "Correlated model-call traces",
            go: () => ctx.go("gateway", "Traces"),
          },
          {
            label: "Healthy providers",
            value: d.providers.filter((p) => p.status === "Healthy").length,
            detail: "Native connector deployments",
            go: () => ctx.go("gateway", "Providers & models"),
          },
          {
            label: "Active applications",
            value: d.projects.filter((p) => p.status === "Active").length,
            detail: "Route, policy and budget bindings",
            go: () => ctx.go("gateway", "Applications & keys"),
          },
          {
            label: "Recorded tokens",
            value: traces
              .reduce((n, t) => n + num(t.tokens), 0)
              .toLocaleString(),
            detail: "Sample usage attribution",
            go: () => ctx.go("budgets", "Usage ledger"),
          },
        ]}
      />
      <div className="cols equal">
        <Panel
          title="Try a governed request"
          sub="Trace the decision from identity to evidence."
        >
          <p>
            Test a safe prompt, sensitive input, an injection attempt, a
            response violation or a provider timeout.
          </p>
          <Button primary onClick={() => ctx.go("gateway", "Playground")}>
            Open playground
          </Button>
        </Panel>
        <Panel title="Provider health">
          <div className="health-grid">
            {d.providers.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  ctx.open(<ResourceDetail collection="providers" id={p.id} />)
                }
              >
                <span>{str(p.name)}</span>
                <Badge value={p.status} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <Traces kind="model" compact />
    </>
  );
}
