import { useState } from "react";
import { Json, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Badge } from "../../components/feedback";
import { Panel } from "../../components/layout";

export function Simulator() {
  const ctx = useConsole(),
    [policy, setPolicy] = useState(ctx.state.data.policies[0]?.id || ""),
    [text, setText] = useState("Review customer 123456789012."),
    [draft, setDraft] = useState(true),
    [stage, setStage] = useState("Request"),
    [sampleFile, setSampleFile] = useState(""),
    [result, setResult] = useState<Record<string, Json> | null>(null);
  return (
    <Panel
      title="Guardrail simulator"
      sub="Compare draft or active policy against text, file content and response samples."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setResult(
              await ctx.mutate("/api/v1/inspect", {
                policy,
                text,
                draft,
                stage: stage === "File / OCR" ? "Request" : stage,
              }),
            );
          } catch {}
        }}
      >
        <div className="form-grid">
          <label className="field">
            Policy
            <select value={policy} onChange={(e) => setPolicy(e.target.value)}>
              {ctx.state.data.policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {str(p.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Inspection stage
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option>Request</option>
              <option>Response</option>
              <option>Tool arguments</option>
              <option>Tool result</option>
              <option>File / OCR</option>
            </select>
          </label>
        </div>
        <label className="row">
          <input
            type="checkbox"
            checked={draft}
            onChange={(e) => setDraft(e.target.checked)}
          />
          Use draft when available
        </label>
        <label className="field">
          Sample content
          <textarea
            aria-label="Sample content"
            value={text}
            rows={5}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label className="field">
          Load a file sample
          <input
            type="file"
            accept=".txt,.md,.json,.pdf,.png,.jpg,.jpeg"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5000000) {
                ctx.notify("Choose a file smaller than 5 MB.");
                return;
              }
              setSampleFile(`${file.name} · ${Math.ceil(file.size / 1024)} KB`);
              setStage("File / OCR");
              if (/\.(txt|md|json)$/i.test(file.name))
                setText((await file.text()).slice(0, 100000));
              else
                setText(
                  "[Simulated OCR extraction] Customer 123456789012 submitted a document for review.",
                );
            }}
          />
        </label>
        {sampleFile && (
          <div className="notice">
            {sampleFile}
            <p>
              Text files use their contents. PDF and image uploads use a labeled
              extraction fixture in this demo.
            </p>
          </div>
        )}
        <Button primary cap="run" type="submit">
          Run simulation
        </Button>
      </form>
      {result && (
        <div className="response-box">
          <Badge value={result.decision} />
          <p>{str(result.reason)}</p>
          <pre>{str(result.text)}</pre>
          <details>
            <summary>Rule matches and offsets</summary>
            <pre>{JSON.stringify(result.findings, null, 2)}</pre>
            <p>
              Offsets use UTF-16 code units. Confidence 1 means an exact fixture
              or dictionary match, not model confidence.
            </p>
          </details>
        </div>
      )}
    </Panel>
  );
}
