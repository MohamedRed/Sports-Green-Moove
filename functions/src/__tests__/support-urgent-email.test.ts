import { describe, expect, it } from "vitest";
import { supportEmailLeaseMs, supportEmailWindowMs, supportMailConfigSchema, supportUrgentMessage } from "../domain/supportUrgentEmail.js";
import { sendSupportUrgentEmail, SupportMailError } from "../services/supportMailProvider.js";

const config = { from: "alerts@example.test", to: "support@example.test", adminOrigin: "https://qa.example.test/" };
const key = "re_synthetic_test_key_only", id = "2967df7e-3512-4f22-8e1c-7309be150435";

describe("support-only urgent email", () => {
  it("requires explicit sender, single recipient and a credential-free HTTPS admin origin", () => {
    expect(supportMailConfigSchema.parse(config)).toEqual(config);
    for (const patch of [{ from: "" }, { to: ["support@example.test", "club@example.test"] }, { to: "" },
      { adminOrigin: "http://qa.example.test/" }, { adminOrigin: "https://u:secret@qa.example.test/" },
      { adminOrigin: "https://qa.example.test/private?token=secret" }, { extra: "clubManager" }])
      expect(supportMailConfigSchema.safeParse({ ...config, ...patch }).success).toBe(false);
  });
  it("sends no description, child identity, private note or reporter email in the notification", () => {
    const message = supportUrgentMessage("report-1", config);
    expect(message.to).toEqual([config.to]); expect(message.text).toContain("https://qa.example.test/#support-report-report-1");
    expect(Object.keys(message).sort()).toEqual(["from", "subject", "text", "to"]);
    expect(message.text).not.toMatch(/description|parent|enfant|reviewNote|@/);
    expect(() => supportUrgentMessage("a\nBcc:club@example.test", config)).toThrow();
    expect(supportEmailWindowMs).toBeLessThan(24 * 60 * 60_000); expect(supportEmailLeaseMs).toBeGreaterThan(15_000);
  });
  it("uses one request, one fixed idempotency key, no redirect and never claims inbox delivery", async () => {
    let calls = 0;
    const request: typeof fetch = async (url, options) => {
      calls++; expect(url).toBe("https://api.resend.com/emails"); expect(options?.method).toBe("POST");
      expect(options?.redirect).toBe("error"); expect(options?.signal).toBeInstanceOf(AbortSignal);
      const headers = new Headers(options?.headers);
      expect(headers.get("idempotency-key")).toBe("support-urgent/report-1");
      expect(headers.get("authorization")).toBe("Bearer " + key);
      expect(JSON.parse(String(options?.body))).toEqual(supportUrgentMessage("report-1", config));
      return Response.json({ id });
    };
    expect(await sendSupportUrgentEmail(supportUrgentMessage("report-1", config), "support-urgent/report-1", key, request)).toBe(id);
    expect(calls).toBe(1);
  });
  it("does not contact a provider without configured credentials", async () => {
    let calls = 0;
    await expect(sendSupportUrgentEmail(supportUrgentMessage("report-1", config), "support-urgent/report-1", "missing",
      async () => { calls++; return Response.json({ id }); })).rejects.toMatchObject({ kind: "configuration" });
    expect(calls).toBe(0);
  });
  it.each([[401, "configuration"], [403, "configuration"], [429, "temporary"], [500, "temporary"],
    [422, "review"], [409, "review"]])("classifies %s without exposing provider output or retrying", async (status, kind) => {
    let calls = 0;
    const request: typeof fetch = async () => { calls++; return Response.json({ secret: key }, { status: Number(status) }); };
    try { await sendSupportUrgentEmail(supportUrgentMessage("report-1", config), "support-urgent/report-1", key, request); expect.fail(); }
    catch (error) { expect(error).toBeInstanceOf(SupportMailError); expect(error).toMatchObject({ kind }); expect(String(error)).not.toContain(key); }
    expect(calls).toBe(1);
  });
  it("keeps timeouts, malformed successes and concurrent idempotency conflicts retryable with the same identity", async () => {
    for (const request of [async () => { throw new Error(key); }, async () => Response.json({}),
      async () => new Response("not-json"), async () => Response.json({ name: "concurrent_idempotent_requests" }, { status: 409 })])
      await expect(sendSupportUrgentEmail(supportUrgentMessage("report-1", config), "support-urgent/report-1", key, request))
        .rejects.toMatchObject({ kind: "temporary" });
  });
});
