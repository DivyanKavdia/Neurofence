import { num, str } from "@neurofence/contracts/types";
import { CollectionContext } from "../context";

export function readCollection(ctx: CollectionContext) {
  const { collection } = ctx;
  const { session, url, id, state, respond, inScope, find } = ctx;
  if (id) {
    const r = structuredClone(find(collection, id));
    delete r.content;
    delete r.fingerprint;
    if (
      collection === "approvals" &&
      ["FinOps owner", "Auditor"].includes(session.role)
    )
      delete r.args;
    return respond(r, true);
  }
  let rows = state.data[collection].filter((r) => inScope(r, collection));
  const query = url.searchParams.get("q")?.toLowerCase(),
    status = url.searchParams.get("status");
  if (query)
    rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query));
  if (status && status !== "All")
    rows = rows.filter((r) => r.status === status || r.decision === status);
  const sort = url.searchParams.get("sort") || "ts";
  rows = [...rows].sort((a, b) =>
    str(b[sort]).localeCompare(str(a[sort]), undefined, { numeric: true }),
  );
  const offset = Math.max(0, num(url.searchParams.get("cursor"))),
    limit = Math.min(
      100,
      Math.max(1, num(url.searchParams.get("limit") ?? 25, 25)),
    );
  const result = respond(
    rows.slice(offset, offset + limit).map((r) => {
      const clean = { ...r };
      delete clean.content;
      delete clean.fingerprint;
      if (
        collection === "approvals" &&
        ["FinOps owner", "Auditor"].includes(session.role)
      )
        delete clean.args;
      return clean;
    }),
    true,
  );
  if (offset + limit < rows.length)
    result.meta.nextCursor = String(offset + limit);
  return result;
}
