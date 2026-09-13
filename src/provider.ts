import type { Session } from "./types";

export interface ProviderCall {
  provider: string;
  prompt: string;
  maxTokens: number;
  traceId: string;
  project: string;
  policyVersion: number;
  session: Session;
}

export interface ProviderReply {
  content: string;
  model: string;
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  elapsedMs: number;
}

export class ProviderFailure extends Error {
  constructor(
    message: string,
    public readonly outcome: "not-executed" | "unknown",
  ) {
    super(message);
  }
}

export interface ProviderConnector {
  readonly mode: "litellm-fixture" | "litellm-live";
  eligible(provider: string, session: Session, region: string): boolean;
  quote(provider: string, prompt: string, maxTokens: number): number;
  execute(call: ProviderCall): Promise<ProviderReply>;
  health(): Promise<"Healthy" | "Unavailable">;
}
