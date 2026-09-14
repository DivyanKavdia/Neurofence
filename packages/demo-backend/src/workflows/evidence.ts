import {
  arr,
  Collection,
  num,
  Row,
  str,
  uid,
} from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { canonical, hash, requireValue } from "../shared/values";
import { resolveCompanyConfig } from "@neurofence/contracts/company";

export async function evidenceOperation(ctx: RequestContext) {
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
    inScope,
  } = ctx;
  permission(action === "export" ? "evidenceExport" : "evidence");
  if (action === "hold" || action === "release") {
    const trace = find("traces", str(body.trace));
    checkVersion(trace);
    requireValue(
      str(body.reason).trim().length >= 5,
      "A custody reason is required.",
    );
    requireValue(
      action !== "hold" || !trace.contentPurgedAt,
      "Purged content cannot be restored by placing a hold.",
    );
    trace.legalHold = action === "hold";
    trace.custody = [
      ...arr(trace.custody),
      { at: Date.now(), actor: session.user, action, reason: str(body.reason) },
    ];
    trace.version++;
    audit(
      action === "hold" ? "Placed evidence hold" : "Released evidence hold",
      str(body.reason),
      trace.id,
    );
    return respond({
      id: trace.id,
      version: trace.version,
      legalHold: trace.legalHold,
    });
  }
  if (action === "retention-preview" || action === "purge") {
    const expired = state.data.traces.filter(
      (t) =>
        inScope(t, "traces") &&
        num(t.ts) <
          Date.now() -
            num(
              resolveCompanyConfig(
                ctx.company,
                session.environment,
                str(t.project),
              ).values.days,
              90,
            ) *
              86400000 &&
        !t.contentPurgedAt,
    );
    const eligible = expired.filter(
      (t) =>
        !t.legalHold &&
        !t.pendingCost &&
        !Object.values(state.gatewayReceipts || {}).some(
          (r) => r.trace === t.id && r.status === "pending",
        ),
    );
    const token = await hash(
      canonical({
        settings: state.settings.version,
        companyConfigVersion: ctx.company.publishedVersion,
        records: eligible.map((t) => [t.id, t.version]).sort(),
      }),
    );
    if (action === "retention-preview")
      return respond(
        {
          token,
          eligible: eligible.map((t) => ({
            id: t.id,
            version: t.version,
            ts: t.ts,
            project: t.project,
          })),
          protected: expired.length - eligible.length,
          days: state.settings.days,
        },
        false,
      );
    requireValue(
      body.token === token,
      "The retention preview changed. Preview the affected records again.",
    );
    requireValue(
      str(body.reason).trim().length >= 5,
      "Explain this retention action.",
    );
    for (const trace of eligible) {
      delete trace.content;
      trace.preview = "Content purged";
      trace.output = "Content purged";
      trace.contentRetained = false;
      trace.contentPurgedAt = Date.now();
      trace.version++;
    }
    audit(
      "Purged expired trace content",
      `${eligible.length} records · ${body.reason}. Ledger, receipts, holds and audit metadata retained.`,
    );
    return respond({
      purged: eligible.length,
      protected: expired.length - eligible.length,
    });
  }
  if (action === "control") {
    const old = body.id ? find("controls", str(body.id)) : undefined;
    if (old) checkVersion(old);
    for (const key of ["name", "framework", "owner", "requirement"])
      requireValue(str(body[key]).trim().length >= 2, `${key} is required.`);
    const references = arr<string>(body.references);
    requireValue(
      references.length > 0 && references.length <= 100,
      "Link 1–100 evidence references.",
    );
    const evidenceCollections: Collection[] = [
      "assets",
      "policies",
      "traces",
      "incidents",
      "campaigns",
      "scans",
      "approvals",
    ];
    for (const ref of references)
      requireValue(
        evidenceCollections.some((c) =>
          state.data[c].some((r) => r.id === ref && inScope(r, c)),
        ),
        "Every evidence reference must exist in this workspace scope.",
      );
    const row: Row = {
      id: old?.id || uid("control"),
      version: (old?.version || 0) + 1,
      name: str(body.name),
      framework: str(body.framework),
      owner: str(body.owner),
      requirement: str(body.requirement),
      references,
      status: "Mapped",
      ts: Date.now(),
      history: [
        ...arr(old?.history),
        ...(old
          ? [
              {
                at: Date.now(),
                name: old.name || "",
                references: old.references || [],
              },
            ]
          : []),
      ],
    };
    if (old) Object.assign(old, row);
    else state.data.controls.unshift(row);
    audit(
      "Updated control evidence mapping",
      `${row.framework} · ${row.name}`,
      row.id,
    );
    return respond(row);
  }
  if (action === "export") {
    const control = find("controls", str(body.control));
    const evidence: Row[] = [];
    for (const c of [
      "assets",
      "policies",
      "traces",
      "incidents",
      "campaigns",
      "scans",
      "approvals",
    ] as Collection[]) {
      for (const row of state.data[c].filter(
        (r) => arr(control.references).includes(r.id) && inScope(r, c),
      )) {
        const copy = { ...row };
        delete copy.content;
        delete copy.fingerprint;
        delete copy.args;
        delete copy.preview;
        delete copy.output;
        evidence.push(copy);
      }
    }
    const manifest = {
      prototype: true,
      generatedAt: Date.now(),
      tenant: session.tenant,
      environment: session.environment,
      control,
      evidence,
    };
    audit("Exported mapped evidence", str(control.name), control.id);
    return respond({
      ...manifest,
      sha256: await hash(canonical(JSON.parse(JSON.stringify(manifest)))),
    });
  }
  requireValue(false, "Unknown evidence operation.");
}
