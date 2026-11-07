import { describe, expect, it } from "vitest";
import { supportSubmissionIdentity, supportSubmissionSchema } from "../domain/supportSubmission.js";
const input = { clientRequestId: "f18da3ad-f4ad-4797-83c1-60ddf07b9228", requesterUserId: "parent",
  subjectType: "other", reason: "Aide", description: "Demande de test", emergency: false } as const;
describe("immutable support submission", () => {
  it("requires explicit identity and normalizes content before binding", () => {
    expect(supportSubmissionSchema.parse({ ...input, reason: " Aide " })).toEqual(input);
    for (const patch of [{ clientRequestId: undefined }, { clientRequestId: "wrong" }, { requesterUserId: "" },
      { subjectId: " " }, { reason: "x" }, { description: "x" }, { emergency: "true" }, { reporterUserId: "foreign" }])
      expect(supportSubmissionSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it("isolates identities by account and binds every content field", () => {
    const row = supportSubmissionSchema.parse(input), identity = supportSubmissionIdentity("parent", row);
    expect(supportSubmissionIdentity("parent", row)).toEqual(identity);
    expect(supportSubmissionIdentity("foreign", row).id).not.toBe(identity.id);
    for (const patch of [{ reason: "Changed" }, { description: "Changed" }, { emergency: true },
      { subjectType: "user" as const }, { subjectId: "subject" }])
      expect(supportSubmissionIdentity("parent", { ...row, ...patch }).digest).not.toBe(identity.digest);
  });
});
