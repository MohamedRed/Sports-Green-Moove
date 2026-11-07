import { describe, expect, it } from "vitest";
import { matchesRatingSubmission } from "../domain/ratingSubmission.js";

describe("immutable rating replay identity", () => {
  const input = { rideSessionId: "ride-29", ratedUserId: "driver", score: 5 };
  const stored = { ...input, authorUserId: "parent", comment: null, createdAt: "original" };
  it("recognizes an exact retry without requiring a new timestamp", () => {
    expect(matchesRatingSubmission(stored, "parent", input)).toBe(true);
    expect(matchesRatingSubmission({ ...stored, comment: "Merci" }, "parent", { ...input, comment: "Merci" })).toBe(true);
  });
  it.each([{ rideSessionId: "ride-28" }, { ratedUserId: "another-driver" }, { authorUserId: "another-parent" },
    { score: 4 }, { comment: "changed" }, { comment: undefined }, { score: "5" }])("rejects a different stored payload %j", patch => {
    expect(matchesRatingSubmission({ ...stored, ...patch }, "parent", input)).toBe(false);
  });
  it("never treats another author or changed comment as a retry", () => {
    expect(matchesRatingSubmission(stored, "another-parent", input)).toBe(false);
    expect(matchesRatingSubmission(stored, "parent", { ...input, comment: "" })).toBe(false);
  });
});
