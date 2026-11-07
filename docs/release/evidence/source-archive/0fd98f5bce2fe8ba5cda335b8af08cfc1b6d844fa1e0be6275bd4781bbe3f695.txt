import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { publicSupportReport, publicSupportReply, supportResponseIdentity, supportResponseSchema } from "../domain/supportReports.js";

const stamp = Timestamp.fromMillis(123456);
const original = { reporterUserId: "parent", subjectType: "other", reason: "Aide", description: "Demande de test", status: "open", createdAt: stamp };
const input = { reportId: "report", requestId: "f18da3ad-f4ad-4797-83c1-60ddf07b9228", text: "Nous avons pris en charge votre demande.",
  expectedStatus: "open", expectedReplyCount: 0, status: "reviewing" } as const;
describe("private support notes and public replies", () => {
  it("projects only the reporter's public fields from a legacy report with no replies", () => {
    const view = publicSupportReport("report", { ...original, reviewNote: "INTERNAL", reviewEvents: [{ secret: "PRIVATE" }], reviewedByUserId: "staff" });
    expect(view.replyCount).toBe(0); expect(view.lastReply).toBeNull(); expect(view.status).toBe("open");
    expect(JSON.stringify(view)).not.toMatch(/INTERNAL|PRIVATE|staff|reporterUserId|reviewNote|reviewEvents/);
  });
  it("projects a complete reply but not its staff identity or operation metadata", () => {
    const reply = { id: "a".repeat(64), text: "Votre demande est traitée.", sequence: 1, sentAt: stamp, authorUid: "staff", digest: "PRIVATE" };
    const view = publicSupportReport("report", { ...original, publicReplyCount: 1, lastPublicReply: reply });
    expect(view.lastReply).toEqual({ id: reply.id, text: reply.text, sequence: 1, sentAtMillis: stamp.toMillis() });
    expect(JSON.stringify(view)).not.toMatch(/staff|PRIVATE|authorUid/);
    expect(publicSupportReply(reply.id, reply)).toEqual(view.lastReply);
  });
  it("fails closed for incomplete or contradictory public records", () => {
    for (const patch of [{ status: "paid" }, { subjectType: "stripeWebhook" }, { publicReplyCount: -1 }, { publicReplyCount: 1 },
      { lastPublicReply: { text: "unexpected" } }, { createdAt: "not a timestamp" }])
      expect(() => publicSupportReport("report", { ...original, ...patch })).toThrow();
    expect(() => publicSupportReply("bad", { text: "reply", sequence: 0, sentAt: stamp })).toThrow();
  });
  it("scopes one response identity to its admin and binds all intended values", () => {
    const first = supportResponseIdentity("admin", input);
    expect(first).toEqual(supportResponseIdentity("admin", input));
    expect(supportResponseIdentity("other", input).id).not.toBe(first.id);
    for (const patch of [{ text: "Changed" }, { reportId: "other" }, { expectedReplyCount: 1 }, { status: "closed" as const }])
      expect(supportResponseIdentity("admin", { ...input, ...patch }).digest).not.toBe(first.digest);
  });
  it("requires an explicit bounded message, version expectation, status and fresh operation identity", () => {
    expect(supportResponseSchema.parse(input)).toEqual(input);
    for (const patch of [{ text: " " }, { text: "x".repeat(2001) }, { requestId: "not-a-uuid" }, { expectedReplyCount: -1 },
      { status: "open" }, { reporterUserId: "another" }]) expect(supportResponseSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});
