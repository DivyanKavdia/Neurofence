import { ReactNode } from "react";
import { ConsoleContext, useConsole } from "./ConsoleContext";

export function TimeScope({
  days,
  children,
}: {
  days: number;
  children: ReactNode;
}) {
  const ctx = useConsole();
  const cutoff = Date.now() - days * 86400000;
  const activity = [
    "overview",
    "gateway",
    "guardrails",
    "agents",
    "incidents",
  ].includes(ctx.page);
  const scoped = activity
    ? {
        ...ctx,
        state: {
          ...ctx.state,
          data: {
            ...ctx.state.data,
            traces: ctx.state.data.traces.filter((t) => Number(t.ts) > cutoff),
          },
        },
      }
    : ctx;
  return (
    <ConsoleContext.Provider value={scoped}>{children}</ConsoleContext.Provider>
  );
}
