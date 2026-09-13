import { readFileSync } from "node:fs";
import {
  ProviderCall,
  ProviderConnector,
  ProviderFailure,
  ProviderReply,
} from "@neurofence/contracts/provider";
import { Session } from "@neurofence/contracts/types";

interface Binding {
  alias: string;
  region: string;
  inputInrPerMillion: number;
  outputInrPerMillion: number;
}

export interface LiteLLMConfig {
  mode: "litellm-fixture" | "litellm-live";
  workspaces: string[];
  providers: Record<string, Binding>;
}

const amount = (n: number) => Math.ceil(n * 1_000_000) / 1_000_000;

const validRate = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;

export class LiteLLMConnector implements ProviderConnector {
  readonly mode: LiteLLMConfig["mode"];
  private readonly base: string;
  constructor(
    private readonly config: LiteLLMConfig,
    base: string,
    private readonly key: string,
    private readonly timeoutMs = 10_000,
  ) {
    const url = new URL(base);
    const internal =
      ["127.0.0.1", "localhost", "[::1]", "litellm"].includes(url.hostname) ||
      url.hostname.endsWith(".svc.cluster.local");
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && internal)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "LiteLLM requires HTTPS or an internal HTTP endpoint, without URL credentials or query parameters.",
      );
    if (key.length < 16)
      throw new Error(
        "Set LITELLM_API_KEY to a server-only key of at least 16 characters.",
      );
    if (
      !["litellm-fixture", "litellm-live"].includes(config.mode) ||
      !Array.isArray(config.workspaces) ||
      !config.workspaces.length ||
      !config.workspaces.every(
        (s) =>
          typeof s === "string" && /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/.test(s),
      )
    )
      throw new Error(
        "Configure the LiteLLM execution mode and explicit tenant:environment workspaces.",
      );
    const bindings = Object.values(config.providers || {});
    if (
      !bindings.length ||
      bindings.some(
        (b) =>
          !b ||
          typeof b.alias !== "string" ||
          !/^[a-zA-Z0-9._-]+$/.test(b.alias) ||
          typeof b.region !== "string" ||
          !b.region ||
          !validRate(b.inputInrPerMillion) ||
          !validRate(b.outputInrPerMillion),
      )
    )
      throw new Error(
        "Each provider needs an alias, deployment region and configured INR token rates.",
      );
    this.mode = config.mode;
    this.base = url.toString().replace(/\/$/, "");
  }
  eligible(provider: string, session: Session, region: string) {
    const binding = this.config.providers[provider];
    return (
      !!binding &&
      this.config.workspaces.includes(
        `${session.tenant}:${session.environment}`,
      ) &&
      (region === "Any region" || binding.region.startsWith("India"))
    );
  }
  quote(provider: string, prompt: string, maxTokens: number) {
    const b = this.config.providers[provider];
    if (!b)
      throw new ProviderFailure(
        "The provider has no approved LiteLLM binding.",
        "not-executed",
      );
    return amount(
      ((Buffer.byteLength(prompt, "utf8") + 128) * b.inputInrPerMillion +
        maxTokens * b.outputInrPerMillion) /
        1_000_000,
    );
  }
  async health(): Promise<"Healthy" | "Unavailable"> {
    try {
      const response = await fetch(`${this.base}/health/liveliness`, {
        headers: { Authorization: `Bearer ${this.key}` },
        signal: AbortSignal.timeout(1500),
        redirect: "error",
      });
      await response.body?.cancel();
      return response.ok ? "Healthy" : "Unavailable";
    } catch {
      return "Unavailable";
    }
  }
  async execute(call: ProviderCall): Promise<ProviderReply> {
    const binding = this.config.providers[call.provider];
    if (
      !binding ||
      !this.config.workspaces.includes(
        `${call.session.tenant}:${call.session.environment}`,
      )
    )
      throw new ProviderFailure(
        "This workspace has no approved LiteLLM binding.",
        "not-executed",
      );
    const started = Date.now();
    try {
      const response = await fetch(`${this.base}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model: binding.alias,
          messages: [{ role: "user", content: call.prompt }],
          max_tokens: call.maxTokens,
          stream: false,
          metadata: {
            neuralfence_trace_id: call.traceId,
            neuralfence_tenant: call.session.tenant,
            neuralfence_environment: call.session.environment,
            neuralfence_project: call.project,
            neuralfence_policy_version: call.policyVersion,
          },
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const rejected = [400, 401, 403, 404, 405, 413, 422, 429].includes(
          response.status,
        );
        throw new ProviderFailure(
          `LiteLLM returned HTTP ${response.status}. ${rejected ? "The request was rejected." : "The provider outcome needs reconciliation."}`,
          rejected ? "not-executed" : "unknown",
        );
      }
      if (!response.body)
        throw new ProviderFailure(
          "LiteLLM returned an empty response.",
          "unknown",
        );
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          throw new ProviderFailure(
            "LiteLLM response exceeded the supported size.",
            "unknown",
          );
        }
        chunks.push(value);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const content = data.choices?.[0]?.message?.content;
      const input = data.usage?.prompt_tokens,
        output = data.usage?.completion_tokens;
      if (
        typeof content !== "string" ||
        typeof data.id !== "string" ||
        typeof data.model !== "string" ||
        !Number.isSafeInteger(input) ||
        input < 0 ||
        !Number.isSafeInteger(output) ||
        output < 0 ||
        input > 10_000_000 ||
        output > 1_000_000 ||
        data.choices?.[0]?.message?.tool_calls?.length
      )
        throw new ProviderFailure(
          "LiteLLM returned an unsupported text or usage response; reconcile provider usage.",
          "unknown",
        );
      return {
        content,
        model: data.model.slice(0, 200),
        requestId: data.id.slice(0, 200),
        inputTokens: input,
        outputTokens: output,
        costInr: amount(
          (input * binding.inputInrPerMillion +
            output * binding.outputInrPerMillion) /
            1_000_000,
        ),
        elapsedMs: Date.now() - started,
      };
    } catch (error) {
      if (error instanceof ProviderFailure) throw error;
      throw new ProviderFailure(
        "LiteLLM did not return a verifiable result. The reservation is held for reconciliation; the request will not be retried automatically.",
        "unknown",
      );
    }
  }
}

export function configuredLiteLLM(): LiteLLMConnector | undefined {
  const mode = process.env.NF_MODEL_RUNTIME || "mock";
  if (mode === "mock") return undefined;
  if (mode !== "litellm")
    throw new Error("NF_MODEL_RUNTIME must be mock or litellm.");
  if (!process.env.NF_LITELLM_BINDINGS)
    throw new Error(
      "Set NF_LITELLM_BINDINGS to an operator-managed JSON file.",
    );
  return new LiteLLMConnector(
    JSON.parse(readFileSync(process.env.NF_LITELLM_BINDINGS, "utf8")),
    process.env.LITELLM_URL || "http://127.0.0.1:4000",
    process.env.LITELLM_API_KEY || "",
  );
}
