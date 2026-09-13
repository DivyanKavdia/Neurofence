import { MockBackend, BrowserStore } from "./backend";
import {
  ApiError,
  initialSession,
  Request,
  Result,
  Session,
  Transport,
} from "./types";
declare global {
  interface Window {
    NEURALFENCE_CONFIG?: { mode?: "mock" | "http"; apiBase?: string };
  }
}
class HttpTransport implements Transport {
  session = { ...initialSession };
  constructor(private base: string) {}
  setSession(session: Session) {
    this.session = { ...session };
  }
  async request<T>(request: Request): Promise<Result<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.base}${request.path}`, {
        method: request.method || "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Demo-Tenant": this.session.tenant,
          "X-Demo-Environment": this.session.environment,
          "X-Demo-Role": this.session.role,
          "X-Demo-User": this.session.user,
          ...(request.version !== undefined
            ? { "If-Match": String(request.version) }
            : {}),
          ...(request.idempotencyKey
            ? { "Idempotency-Key": request.idempotencyKey }
            : {}),
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ApiError(
        503,
        "CONNECTION_FAILED",
        "The control API could not be reached. Check the connection and retry.",
        true,
      );
    }
    const result = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        result.error?.code || "API_ERROR",
        result.error?.message || "The request failed.",
        !!result.error?.retryable,
        result.error?.correlationId,
      );
    return result;
  }
}
const config = window.NEURALFENCE_CONFIG || {};
export const api: Transport =
  config.mode === "http"
    ? new HttpTransport(config.apiBase || "")
    : new MockBackend(new BrowserStore());
