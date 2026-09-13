import { arr, Json, Row, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Badge, Notice } from "../../components/feedback";
import { Details } from "../../components/layout";
import { download } from "../../lib/files";

export function TraceView({ trace }: { trace: Row }) {
  const ctx = useConsole();
  const reveal = async () => {
    try {
      const result = await ctx.mutate<{ content: Json }>(
        `/api/v1/traces/${trace.id}/reveal`,
        {},
        trace,
      );
      ctx.open(
        <>
          <h2>Retained content</h2>
          <Notice>This access has been added to the audit trail.</Notice>
          <pre>{JSON.stringify(result.content, null, 2)}</pre>
        </>,
      );
    } catch {}
  };
  return (
    <>
      <div className="row between wrap">
        <Badge value={trace.decision} />
        <span className="mono small">{trace.id}</span>
      </div>
      <p>{str(trace.reason)}</p>
      <Details
        row={trace}
        fields={[
          "principal",
          "target",
          "policyVersion",
          "workflow",
          "tokens",
          "cost",
          "budgetAttribution",
          ...(str(trace.modelRuntime).startsWith("litellm-")
            ? [
                "modelRuntime",
                "upstreamRequestId",
                "inputTokens",
                "outputTokens",
                "billingBasis",
                "pendingCost",
              ]
            : []),
        ]}
      />
      <div className="waterfall">
        {arr<Record<string, Json>>(trace.stages).map((s, i) => (
          <div className="trace-stage" key={i}>
            <span className="step-number">{i + 1}</span>
            <div>
              <strong>{str(s.name)}</strong>
              <p>{str(s.detail)}</p>
            </div>
            <Badge value={s.status} />
          </div>
        ))}
      </div>
      {trace.output && (
        <div className="response-box">
          <strong>Response</strong>
          <p>{str(trace.output)}</p>
        </div>
      )}
      <div className="row wrap">
        <Button
          onClick={async () => {
            try {
              download(
                "trace-evidence.json",
                await ctx.mutate(
                  `/api/v1/traces/${trace.id}/export`,
                  {},
                  trace,
                ),
              );
            } catch {}
          }}
        >
          Export evidence
        </Button>
        <Button cap="reveal" onClick={reveal}>
          Reveal retained content
        </Button>
        <Button
          cap="run"
          disabled={ctx.session.environment === "Production"}
          onClick={() =>
            ctx.go(
              trace.kind === "tool" ? "agents" : "gateway",
              trace.kind === "tool" ? "Tool playground" : "Playground",
              trace.id,
            )
          }
        >
          Replay in playground
        </Button>
      </div>
    </>
  );
}
