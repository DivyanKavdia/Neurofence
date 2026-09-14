import { CompanyDirectory } from "./company";
import { ApiError, Role, Session } from "./types";

/** Input from a server-side OIDC/SAML verifier, never from request JSON or demo headers. */
export type VerifiedIdentity = {
  issuer: string;
  subject: string;
  authenticatedAt: number;
  expiresAt: number;
};
export type IdentityBinding = {
  issuer: string;
  subject: string;
  tenant: string;
  memberId: string;
};

/** Production seam: callers verify signature, audience, issuer and session/CSRF before calling. */
export function sessionForVerifiedIdentity(
  identity: VerifiedIdentity,
  selection: { tenant: string; environment: string; role: Role },
  directory: CompanyDirectory,
  bindings: IdentityBinding[],
  now = Date.now(),
): Session {
  if (
    !identity.issuer ||
    !identity.subject ||
    !Number.isFinite(identity.authenticatedAt) ||
    !Number.isFinite(identity.expiresAt) ||
    identity.authenticatedAt > now ||
    identity.expiresAt <= now ||
    selection.role === "Neurofence operator"
  )
    throw new ApiError(
      401,
      "INVALID_IDENTITY",
      "A current verified company identity is required.",
    );
  const company = directory.companies.find((c) => c.id === selection.tenant);
  const binding = bindings.find(
    (b) =>
      b.tenant === selection.tenant &&
      b.issuer === identity.issuer &&
      b.subject === identity.subject,
  );
  const member = company?.members.find((m) => m.id === binding?.memberId);
  if (
    !company ||
    company.status === "Suspended" ||
    !company.environments.includes(selection.environment) ||
    !member ||
    member.status !== "Active" ||
    !member.roles.includes(selection.role)
  )
    throw new ApiError(
      403,
      "FORBIDDEN",
      "The identity has no active membership for this company, environment and role.",
    );
  if (
    company.config.values.identityMode === "Demo" ||
    company.config.values.issuer !== identity.issuer
  )
    throw new ApiError(
      403,
      "ISSUER_DENIED",
      "This issuer is not the company's published identity provider.",
    );
  if (
    now - identity.authenticatedAt >
    Number(company.config.values.sessionMinutes) * 60000
  )
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "Sign in again under the company's session policy.",
    );
  return {
    ...selection,
    user: member.name,
    subject: member.subject,
    region: String(company.config.values.residency),
  };
}
