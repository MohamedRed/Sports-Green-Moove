import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { adultTeamChatAccount, earliestCurrentAdmission, latestAdmission, sendTeamMessageSchema,
  teamMessageFingerprint, teamMessageOperationId } from "../domain/teamConversation.js";

describe("adult team conversation policy", () => {
  it("requires both current profile authority and claims; mixed child roles never qualify", () => {
    expect(adultTeamChatAccount({ roleKeys: ["parent"] }, { roles: { parent: true } })).toBe(true);
    expect(adultTeamChatAccount({ roleKeys: ["driver"] }, { roles: { driver: true } })).toBe(true);
    for (const [token, profile] of [
      [{ roleKeys: ["parent", "child"] }, { roles: { parent: true } }],
      [{ roleKeys: ["parent"] }, { roles: { parent: true, child: true } }],
      [{ roleKeys: ["parent"] }, { roles: { driver: true } }],
      [{ roleKeys: ["admin"] }, { roles: { admin: true } }],
      [{ roleKeys: ["parent"] }, undefined],
    ]) expect(adultTeamChatAccount(token, profile)).toBe(false);
  });
  it("uses the most recent grant for each path, then the earliest still-current eligible path", () => {
    const first = new Timestamp(10, 999), second = new Timestamp(11, 0), latest = new Timestamp(11, 1);
    expect(latestAdmission(first, latest, second)).toBe(latest);
    expect(earliestCurrentAdmission([second, latest])).toBe(second);
    expect(() => latestAdmission(first, null)).toThrow();
    expect(() => earliestCurrentAdmission([])).toThrow();
  });
  it("binds idempotency to actor, body and immutable team identity", () => {
    const input = { teamId: "team", expectedTeamInstanceId: "a".repeat(64),
      clientMessageId: "12345678-1234-4234-8234-123456789abc", body: " Bonjour " };
    const parsed = sendTeamMessageSchema.parse(input);
    expect(parsed.body).toBe("Bonjour");
    expect(teamMessageOperationId("one", input.clientMessageId)).not.toBe(teamMessageOperationId("two", input.clientMessageId));
    expect(teamMessageFingerprint(parsed)).not.toBe(teamMessageFingerprint({ ...parsed, body: "Autre" }));
    expect(teamMessageFingerprint(parsed)).not.toBe(teamMessageFingerprint({ ...parsed, expectedTeamInstanceId: "b".repeat(64) }));
    for (const change of [{ body: " " }, { body: "x".repeat(1001) }, { clientMessageId: "" },
      { expectedTeamInstanceId: "old" }, { availableAfter: 0 }]) expect(sendTeamMessageSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
});
