import { num, Row, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";

export function RouteCanvas({ row }: { row: Row }) {
  const { state } = useConsole();
  const label = (id: unknown) =>
    str(state.data.providers.find((p) => p.id === id)?.name || "Not selected");
  return (
    <div className="route-canvas" aria-label="Route conditions and fallback">
      <div className="route-entry">
        <strong>{str(row.alias || row.name)}</strong>
        <span>Identity · guardrails · parent budgets</span>
      </div>
      <div className="route-branches">
        <div>
          <span className="eyebrow">Primary · when eligible</span>
          <strong>{label(row.primary)}</strong>
          <small>{str(row.region || "India only")}</small>
        </div>
        <div>
          <span className="eyebrow">Fallback · health or budget</span>
          <strong>{label(row.fallback)}</strong>
          <small>
            Below {num(row.threshold)}% remaining · {num(row.retries)} retry
            limit
          </small>
        </div>
      </div>
      <div className="route-exit">
        No eligible route → block and record evidence
      </div>
    </div>
  );
}
