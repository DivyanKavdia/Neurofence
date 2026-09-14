import { Company } from "@neurofence/contracts/company";
import { ApiError, Json, Row, uid } from "@neurofence/contracts/types";
import { RequestContext } from "../context";
import { canonical } from "../shared/values";
import { resolveMembership } from "./directory";

const asJson = (value: unknown): Json => JSON.parse(JSON.stringify(value));

/** Saves company data and retry receipts together, outside environment snapshots. */
export function companyTransaction(ctx: RequestContext) {
  const { company, directory, session, services, request, method, body } = ctx;
  const operator = session.role === "Neurofence operator";
  const receiptKey = `${session.tenant}:${session.subject || session.user}:${session.role}:${request.idempotencyKey}`;
  const payload = canonical({
    path: request.path,
    method,
    body,
    version: request.version ?? null,
  });
  const receipt = directory.receipts[receiptKey];
  const actor = operator ? "operator" : resolveMembership(company, session).id;
  const audit = (c: Company, event: string, detail: string) =>
    c.audit.unshift({
      id: uid("company-event"),
      version: 1,
      ts: Date.now(),
      actor: session.user,
      subject: actor,
      role: session.role,
      event,
      detail,
      tenant: c.id,
    });
  const saveCompany = (
    c: Company,
    event: string,
    detail: string,
    data?: unknown,
  ) => {
    c.version++;
    audit(c, event, detail);
    directory.revision++;
    const output = data ? { ...(data as object), version: c.version } : c;
    directory.receipts[receiptKey] = { payload, data: asJson(output) };
    // Bound demo receipt storage while preserving retries across HTTP restarts.
    const keys = Object.keys(directory.receipts);
    for (const key of keys.slice(0, Math.max(0, keys.length - 100)))
      delete directory.receipts[key];
    for (const key of keys) {
      if (
        key === receiptKey ||
        JSON.stringify(directory.receipts).length <= 750000
      )
        break;
      delete directory.receipts[key];
    }
    services.store.writeDirectory(directory);
    return ctx.respond(output, false);
  };
  const checkCompanyVersion = (c = company) =>
    ctx.checkVersion(c as unknown as Row);

  const replay = () => {
    if (method !== "GET" && receipt) {
      if (receipt.payload !== payload)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This company request key was already used with different values.",
        );
      return ctx.respond(receipt.data, false);
    }
  };
  return { actor, saveCompany, checkCompanyVersion, replay };
}

export type CompanyCommand = RequestContext &
  ReturnType<typeof companyTransaction>;
