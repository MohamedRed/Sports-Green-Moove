import type { SupportUrgentMessage } from "../domain/supportUrgentEmail.js";

export class SupportMailError extends Error {
  constructor(readonly kind: "temporary" | "configuration" | "review") { super("Support email: " + kind); }
}

export async function sendSupportUrgentEmail(message: SupportUrgentMessage, key: string, apiKey: string, request = fetch) {
  if (!/^re_[A-Za-z0-9_-]{16,}$/.test(apiKey)) throw new SupportMailError("configuration");
  let response: Response;
  try {
    response = await request("https://api.resend.com/emails", { method: "POST", redirect: "error",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify(message), signal: AbortSignal.timeout(15_000) });
  } catch { throw new SupportMailError("temporary"); }
  if ([401, 403].includes(response.status)) throw new SupportMailError("configuration");
  if (response.status === 429 || response.status >= 500) throw new SupportMailError("temporary");
  let result: unknown;
  try { result = await response.json(); } catch { throw new SupportMailError("temporary"); }
  if (!response.ok) {
    if (response.status === 409 && typeof result === "object" && result !== null &&
        "name" in result && result.name === "concurrent_idempotent_requests") throw new SupportMailError("temporary");
    throw new SupportMailError("review");
  }
  if (typeof result !== "object" || result === null || !("id" in result) ||
      typeof result.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(result.id)) throw new SupportMailError("temporary");
  return result.id;
}
