import { ApiError, Json } from "@neurofence/contracts/types";

export const canonical = (value: Json): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value !== null && typeof value === "object"
      ? `{${Object.keys(value)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
          .join(",")}}`
      : JSON.stringify(value);

export const mask = (text: string) =>
  text
    .replace(/\b\d{12,16}\b/g, "[IDENTIFIER]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\b(?:sk-|api_key[=: ]+)[A-Za-z0-9_-]{8,}\b/gi, "[SECRET]");

export function requireValue(
  ok: unknown,
  message: string,
  code = "VALIDATION",
) {
  if (!ok) throw new ApiError(422, code, message);
}

export async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
