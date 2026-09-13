import { arr, Row, State, str } from "@neurofence/contracts/types";
import { mask } from "../shared/values";

export function inspect(text: string, policy: Row, state: State) {
  const active = arr(policy.detectors).filter((id) =>
    state.data.detectors.some((d) => d.id === id && d.status === "Active"),
  );
  const signals: string[] = [];
  if (
    active.includes("pii") &&
    (/\b\d{12,16}\b/.test(text) ||
      /\b[A-Z]{5}\d{4}[A-Z]\b/.test(text) ||
      /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))
  )
    signals.push("Personal identifiers");
  if (
    active.includes("secrets") &&
    /\b(?:sk-|api_key[=: ]+)[a-z0-9_-]{8,}/i.test(text)
  )
    signals.push("Secret");
  if (
    active.includes("injection") &&
    /ignore (all |previous |the )?instructions|reveal (the )?system prompt|bypass.*safety/i.test(
      text,
    )
  )
    signals.push("Prompt injection");
  const order: Record<string, string> = {
    pii: "Personal identifiers",
    secrets: "Secret",
    injection: "Prompt injection",
  };
  signals.sort(
    (a, b) =>
      active.findIndex((id) => order[str(id)] === a) -
      active.findIndex((id) => order[str(id)] === b),
  );
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
  return {
    decision,
    signals,
    text: decision === "REDACT" ? mask(text) : text,
    reason: signals.length
      ? `${signals.join(", ")} · ${decision.toLowerCase()}`
      : "Identity and configured sample checks passed",
  };
}
