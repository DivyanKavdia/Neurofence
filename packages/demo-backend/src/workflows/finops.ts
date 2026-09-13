import {
  arr,
  Json,
  num,
  obj,
  Row,
  str,
  uid,
} from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { createTrace } from "../execution/trace";
import { canonical, requireValue } from "../shared/values";

const amount = (
  value: unknown,
  label: string,
  integer = false,
  maximum = 1e12,
) => {
  requireValue(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= maximum &&
      (!integer || Number.isInteger(value)),
    `${label} must be a finite, nonnegative ${integer ? "integer" : "number"}.`,
  );
  return value as number;
};

export function finopsOperation(ctx: RequestContext) {
  const {
    action,
    body,
    state,
    session,
    find,
    checkVersion,
    permission,
    respond,
    audit,
  } = ctx;
  permission("budgets");
  if (action === "price") {
    const model = find("models", str(body.model));
    const effectiveAt = amount(
      body.effectiveAt,
      "Effective date",
      true,
      8.64e15,
    );
    requireValue(
      effectiveAt > 0 && body.currency === "INR",
      "Choose an effective date and INR ledger currency.",
    );
    requireValue(
      !state.data.prices.some(
        (p) => p.model === model.id && p.effectiveAt === effectiveAt,
      ),
      "A price version already exists for this model and effective date.",
    );
    const price: Row = {
      id: uid("price"),
      version: 1,
      name: str(model.name),
      model: model.id,
      effectiveAt,
      currency: "INR",
      unit: "per million tokens",
      ts: Date.now(),
      status: "Published",
    };
    for (const key of ["inputRate", "outputRate", "cacheRate", "reasoningRate"])
      price[key] = amount(body[key], key);
    state.data.prices.unshift(price);
    audit(
      "Published immutable price version",
      `${model.name} · ${new Date(effectiveAt).toISOString()}`,
      price.id,
    );
    return respond(price);
  }
  if (action === "usage-preview" || action === "usage-import") {
    const source = str(body.source).trim(),
      entries = arr<Record<string, Json>>(body.entries),
      seen = new Set<string>();
    requireValue(
      /^[a-zA-Z0-9._-]{2,80}$/.test(source) &&
        entries.length > 0 &&
        entries.length <= 250,
      "Supply a stable source and 1–250 usage records.",
    );
    const preview = entries.map((entry) => {
      const value = obj(entry),
        externalId = str(value.externalId).trim();
      requireValue(
        externalId && externalId.length <= 150 && !seen.has(externalId),
        "External usage IDs must be unique within the batch.",
      );
      seen.add(externalId);
      const project = find("projects", str(value.project)),
        model = find("models", str(value.model));
      const ts = amount(value.ts, "Usage timestamp", true, 8.64e15);
      requireValue(
        ts > 0 && ts <= Date.now() + 60000,
        "Usage timestamp cannot be in the future.",
      );
      const tokens: Record<string, Json> = {};
      for (const key of [
        "inputTokens",
        "outputTokens",
        "cacheTokens",
        "reasoningTokens",
      ])
        tokens[key] = amount(value[key] ?? 0, key, true);
      // Categories are disjoint: outputTokens excludes reasoning; inputTokens excludes cache reads.
      const normalized = {
        externalId,
        project: project.id,
        model: model.id,
        ts,
        ...tokens,
        costCenter: str(
          value.costCenter || project.costCenter || "Unallocated",
        ),
      };
      const old = state.data.traces.find(
        (t) => t.importSource === source && t.externalId === externalId,
      );
      requireValue(
        !old || old.importFingerprint === canonical(normalized),
        "An external ID already has different usage. Reconcile its ledger record instead of importing it again.",
      );
      if (old) return { change: "Unchanged", trace: old };
      const price = state.data.prices
        .filter((p) => p.model === model.id && num(p.effectiveAt) <= ts)
        .sort((a, b) => num(b.effectiveAt) - num(a.effectiveAt))[0];
      requireValue(
        price,
        `Publish an effective price for ${model.name} before importing this usage.`,
      );
      const cost =
        (num(tokens.inputTokens) * num(price.inputRate) +
          num(tokens.outputTokens) * num(price.outputRate) +
          num(tokens.cacheTokens) * num(price.cacheRate) +
          num(tokens.reasoningTokens) * num(price.reasoningRate)) /
        1e6;
      const trace: Row = {
        ...createTrace("external", session, project),
        ...normalized,
        importSource: source,
        importFingerprint: canonical(normalized),
        priceVersion: price.id,
        cost: Math.round(cost * 1e6) / 1e6,
        tokens: Object.values(tokens).reduce<number>((n, t) => n + num(t), 0),
        executed: true,
        decision: "RECORDED",
        reason: "Imported provider usage; no request executed by Neurofence",
        modelRuntime: "import",
        reconciliation: "Pending",
        stages: [],
      };
      return { change: "Create", trace };
    });
    if (action === "usage-preview") return respond(preview, false);
    for (const item of preview)
      if (item.change === "Create") state.data.traces.unshift(item.trace);
    audit(
      "Imported external usage",
      `${source}: ${preview.filter((p) => p.change === "Create").length} new ledger records`,
    );
    return respond(preview);
  }
  if (action === "reconcile") {
    const trace = find("traces", str(body.trace));
    checkVersion(trace);
    requireValue(
      trace.executed || trace.pendingCost,
      "Only executed requests or held reservations can be reconciled.",
    );
    requireValue(
      !state.data.jobs.some(
        (j) =>
          j.collection === "traces" &&
          j.resource === trace.id &&
          j.status === "Running",
      ),
      "Wait for the pending reconciliation job before applying an invoice adjustment.",
    );
    const cost = amount(body.cost, "Verified invoice amount"),
      reason = str(body.reason).trim(),
      invoice = str(body.invoice).trim();
    requireValue(
      reason.length >= 5 && invoice.length >= 2 && invoice.length <= 120,
      "Provide an invoice reference and reconciliation reason.",
    );
    trace.adjustments = [
      ...arr(trace.adjustments),
      {
        at: Date.now(),
        actor: session.user,
        before: num(trace.cost),
        after: cost,
        invoice,
        reason,
      },
    ];
    trace.cost = cost;
    trace.reconciliation = "Reconciled";
    trace.reservation = 0;
    trace.pendingCost = false;
    trace.invoice = invoice;
    trace.version++;
    // Receipt remains durable and cannot be reused to execute a second provider request.
    for (const receipt of Object.values(state.gatewayReceipts || {}))
      if (receipt.trace === trace.id) receipt.status = "complete";
    audit(
      "Reconciled usage against invoice",
      `${invoice} · INR ${cost} · ${reason}`,
      trace.id,
    );
    return respond(trace);
  }
  requireValue(false, "Unknown FinOps operation.");
}
