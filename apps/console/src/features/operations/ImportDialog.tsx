import { useState } from "react";
import { Json, obj, Row, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/feedback";
import { download } from "../../lib/files";

export function ImportDialog({
  domain,
  sample,
}: {
  domain: "inventory" | "finops";
  sample: Record<string, Json>[];
}) {
  const ctx = useConsole(),
    [source, setSource] = useState("manual-upload"),
    [input, setInput] = useState(JSON.stringify(sample, null, 2));
  const [preview, setPreview] = useState<Row[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [validated, setValidated] = useState<Record<string, Json> | null>(null);
  const change = (text: string) => {
    setInput(text);
    setPreview(null);
    setValidated(null);
    setError("");
  };
  const execute = async (commit: boolean) => {
    setBusy(true);
    setError("");
    try {
      const body = commit
        ? validated!
        : { source, entries: JSON.parse(input) as Json };
      if (!body || !Array.isArray(body.entries))
        throw new Error("Supply a JSON array of normalized records.");
      const action =
        domain === "inventory"
          ? commit
            ? "import"
            : "preview"
          : commit
            ? "usage-import"
            : "usage-preview";
      const result = await ctx.mutate<Row[]>(
        `/api/v1/operations/${domain}/${action}`,
        body,
      );
      if (commit) {
        ctx.close();
        ctx.notify(
          "Import completed. Existing external IDs were checked for duplicates.",
        );
      } else {
        setValidated(body);
        setPreview(
          result.map((entry) => ({
            ...obj(entry.asset || entry.trace),
            change: entry.change,
            id: str(obj(entry.asset || entry.trace).id),
            version: 1,
          })),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h2>
        {domain === "inventory"
          ? "Import discovered assets"
          : "Import external usage"}
      </h2>
      <Notice>
        {domain === "inventory"
          ? "Use normalized JSON from your inventory or SBOM export. Existing source + external ID pairs update the discovered metadata and preserve accountable ownership."
          : "Usage categories are disjoint. Input excludes cache reads; output excludes reasoning. Publish an effective INR price first. Imports add ledger charges without sending model requests."}
      </Notice>
      <div className="field">
        <label htmlFor="import-source">Source identifier</label>
        <input
          id="import-source"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPreview(null);
            setValidated(null);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="import-file">Choose JSON file</label>
        <input
          id="import-file"
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 1_000_000) {
              setError("Choose a JSON file below 1 MB.");
              return;
            }
            try {
              change(await file.text());
            } catch {
              setError("This file could not be read.");
            }
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="import-records">Normalized records</label>
        <textarea
          id="import-records"
          rows={10}
          value={input}
          onChange={(e) => change(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {preview && (
        <DataTable
          name="Import preview"
          rows={preview}
          columns={[
            { key: "change", label: "Change" },
            { key: "externalId", label: "External ID" },
            {
              key: domain === "inventory" ? "name" : "project",
              label: domain === "inventory" ? "Asset" : "Application",
            },
            {
              key: domain === "inventory" ? "riskScore" : "cost",
              label: domain === "inventory" ? "Risk / 100" : "Charge (INR)",
            },
          ]}
        />
      )}
      <div className="dialog-actions">
        <Button
          onClick={() => download(`${domain}-import-example.json`, sample)}
        >
          Download example
        </Button>
        <Button onClick={ctx.close}>Cancel</Button>
        <Button disabled={busy} onClick={() => execute(false)}>
          Preview import
        </Button>
        <Button
          primary
          disabled={busy || !validated}
          onClick={() => execute(true)}
        >
          Apply import
        </Button>
      </div>
    </>
  );
}
