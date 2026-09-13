import { arr, Row, State, str } from "@neurofence/contracts/types";

import { mask } from "../shared/values";

export type InspectionStage =
  "Request" | "Response" | "Tool arguments" | "Tool result";
type Finding = {
  detector: string;
  detectorVersion: number;
  rule: string;
  category: string;
  start: number;
  end: number;
  confidence: number;
};

/** Deterministic fixtures and bounded literal dictionaries; offsets use UTF-16 code units. */
export function inspect(
  text: string,
  policy: Row,
  state: State,
  stage: InspectionStage = "Request",
) {
  const findings: Finding[] = [];
  const definitions: Record<
    string,
    { category: string; pattern: RegExp; stages: InspectionStage[] }
  > = {
    pii: {
      category: "Personal identifiers",
      pattern:
        /\b\d{12,16}\b|\b[A-Z]{5}\d{4}[A-Z]\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,
      stages: ["Request", "Response", "Tool arguments", "Tool result"],
    },
    secrets: {
      category: "Secret",
      pattern: /\b(?:sk-|api_key[=: ]+)[a-z0-9_-]{8,}/gi,
      stages: ["Request", "Response", "Tool arguments", "Tool result"],
    },
    injection: {
      category: "Prompt injection",
      pattern:
        /ignore (all |previous |the )?instructions|reveal (the )?system prompt|bypass[^\n]{0,100}safety/gi,
      stages: ["Request", "Tool arguments", "Tool result"],
    },
    content: {
      category: "Unsafe sample content",
      pattern: /\[demo:unsafe-content\]/gi,
      stages: ["Response", "Tool result"],
    },
  };
  let capacityExceeded = false;
  inspection: for (const id of arr<string>(policy.detectors)) {
    const detector = state.data.detectors.find(
      (d) => d.id === id && d.status === "Active",
    );
    if (!detector) continue;
    const definition = definitions[id];
    if (definition && definition.stages.includes(stage)) {
      for (const match of text.matchAll(definition.pattern)) {
        if (findings.length >= 1000) {
          capacityExceeded = true;
          break inspection;
        }
        findings.push({
          detector: id,
          detectorVersion: detector.version,
          rule: id,
          category: definition.category,
          start: match.index,
          end: match.index + match[0].length,
          confidence: 1,
        });
      }
    }
    if (
      detector.kind === "Dictionary" &&
      arr(detector.stages).includes(stage)
    ) {
      for (const [index, term] of arr<string>(detector.terms).entries()) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        for (const match of text.matchAll(new RegExp(escaped, "gi"))) {
          if (findings.length >= 1000) {
            capacityExceeded = true;
            break inspection;
          }
          findings.push({
            detector: id,
            detectorVersion: detector.version,
            rule: `term-${index + 1}`,
            category: str(detector.name),
            start: match.index,
            end: match.index + match[0].length,
            confidence: 1,
          });
        }
      }
    }
  }
  if (capacityExceeded)
    return {
      decision: "DENY",
      signals: ["Inspection capacity exceeded"],
      findings: [],
      stage,
      offsetUnit: "UTF-16 code units",
      text: "",
      reason: "Inspection capacity exceeded; split the input before retrying",
    };
  const signals = [...new Set(findings.map((f) => f.category))];
  const block =
    (signals.includes("Prompt injection") && policy.injection === "block") ||
    (signals.length > 0 && policy.pii === "block");
  const decision =
    policy.mode === "monitor"
      ? "MONITOR"
      : block
        ? "DENY"
        : signals.length && policy.pii === "redact"
          ? "REDACT"
          : "ALLOW";
  const spans: { start: number; end: number; literal: boolean }[] = [];
  for (const finding of [...findings].sort((a, b) => a.start - b.start)) {
    const last = spans.at(-1);
    if (last && finding.start <= last.end) {
      last.end = Math.max(last.end, finding.end);
      last.literal ||= finding.rule.startsWith("term-");
    } else
      spans.push({
        start: finding.start,
        end: finding.end,
        literal: finding.rule.startsWith("term-"),
      });
  }
  let inspected = text;
  if (decision === "REDACT")
    for (const span of spans.reverse())
      inspected =
        inspected.slice(0, span.start) +
        (span.literal ||
        mask(text.slice(span.start, span.end)) ===
          text.slice(span.start, span.end)
          ? "[REDACTED]"
          : mask(text.slice(span.start, span.end))) +
        inspected.slice(span.end);
  return {
    decision,
    signals,
    findings,
    stage,
    offsetUnit: "UTF-16 code units",
    text: inspected,
    reason: signals.length
      ? `${signals.join(", ")} · ${decision.toLowerCase()}`
      : "Identity and configured sample checks passed",
  };
}
