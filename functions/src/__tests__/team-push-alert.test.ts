import { describe, expect, it } from "vitest";
import { teamPushAlertRequestSchema } from "../domain/teamPushAlert.js";

const input = { installationId: "11223344-1234-4234-8234-123456789abc", installationSecret: "a".repeat(64),
  revision: 1, notificationId: "teamChat_" + "b".repeat(64), purpose: "display" };
describe("opaque team alert resolution request", () => {
  it("reuses the private installation contract and canonicalizes the UUID", () => {
    expect(teamPushAlertRequestSchema.parse({ ...input, installationId: input.installationId.toUpperCase() })).toEqual(input);
    expect(teamPushAlertRequestSchema.parse({ ...input, purpose: "open" }).purpose).toBe("open");
  });
  for (const change of [{ userId: "other" }, { token: "synthetic_token" }, { platform: "android" },
    { body: "untrusted" }, { target: { teamId: "other" } }, { notificationId: "ordinary" },
    { notificationId: "teamChat_" + "B".repeat(64) }, { notificationId: "teamChat_" + "b".repeat(64) + "\n" },
    { installationId: "../other" }, { installationSecret: "A".repeat(64) }, { installationSecret: "a" },
    { revision: 0 }, { revision: 1.5 }, { revision: Number.MAX_SAFE_INTEGER }, { revision: undefined },
    { purpose: undefined }, { purpose: "read" }])
    it("rejects an invalid or caller-selected " + Object.keys(change)[0], () => {
      expect(teamPushAlertRequestSchema.safeParse({ ...input, ...change }).success).toBe(false);
    });
});
