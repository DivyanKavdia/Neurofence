import { num, Row, State, str } from "./types";

export function periodStart(period: unknown, now = Date.now()) {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  if (period === "Monthly") date.setUTCDate(1);
  if (period === "Weekly")
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.getTime();
}

export function budgetScope(state: State, id: string) {
  const ids = new Set([id]);
  for (let i = 0; i < state.data.budgets.length; i++)
    for (const b of state.data.budgets)
      if (ids.has(str(b.parent))) ids.add(b.id);
  return ids;
}

export function budgetSpend(state: State, budget: Row) {
  const ids = budgetScope(state, budget.id),
    start = periodStart(budget.period);
  return state.data.traces
    .filter((t) => ids.has(str(t.budgetScope)) && num(t.ts) >= start)
    .reduce((n, t) => n + num(t.cost), 0);
}
