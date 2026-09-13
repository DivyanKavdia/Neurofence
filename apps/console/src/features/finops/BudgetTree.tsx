import React from "react";
import { budgetSpend } from "@neurofence/contracts/ledger";
import { num, str } from "@neurofence/contracts/types";
import { useConsole } from "../../app/ConsoleContext";
import { Button } from "../../components/Button";
import { Badge, Empty } from "../../components/feedback";
import { Panel } from "../../components/layout";
import { money } from "../../lib/format";
import { Catalog } from "../catalog/Catalog";
import { Editor } from "../catalog/Editor";
import { ResourceDetail } from "../catalog/ResourceDetail";

export function BudgetTree() {
  const ctx = useConsole(),
    d = ctx.state.data;
  const branch = (
    parent: string,
    depth = 0,
    seen = new Set<string>(),
  ): React.ReactNode =>
    d.budgets
      .filter((b) => str(b.parent) === parent)
      .map((b) => {
        if (seen.has(b.id)) return null;
        const next = new Set(seen).add(b.id),
          used = budgetSpend(ctx.state, b);
        return (
          <React.Fragment key={b.id}>
            <button
              className="budget-node"
              style={{ paddingLeft: `${16 + Math.min(depth, 4) * 20}px` }}
              onClick={() =>
                ctx.open(<ResourceDetail collection="budgets" id={b.id} />)
              }
            >
              <div>
                <strong>{str(b.name)}</strong>
                <small>
                  {str(b.period)} · {str(b.action)} ·{" "}
                  {b.hard ? "Hard limit" : "Soft limit"}
                </small>
              </div>
              <div>
                <span>
                  {money(used)} / {money(b.limit)}
                </span>
                <progress
                  max={Math.max(1, num(b.limit))}
                  value={Math.min(used, num(b.limit))}
                />
              </div>
              <Badge value={b.status} />
            </button>
            {branch(b.id, depth + 1, next)}
          </React.Fragment>
        );
      });
  return (
    <>
      <Panel
        title="Inherited budget hierarchy"
        sub="Every applicable parent limit is checked before a simulated execution."
        actions={
          <Button
            cap="budgets"
            primary
            onClick={() => ctx.open(<Editor collection="budgets" />)}
          >
            Add budget
          </Button>
        }
      >
        {branch("")}
        {!d.budgets.length && <Empty />}
      </Panel>
      <Catalog
        collection="budgets"
        title="Budget configuration"
        sub="Set spend, tokens, requests, concurrency and threshold actions."
        columns={["name", "parent", "limit", "period", "action", "status"]}
      />
    </>
  );
}
