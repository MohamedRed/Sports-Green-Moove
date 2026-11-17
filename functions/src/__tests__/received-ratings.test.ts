import { describe, expect, it } from "vitest";
import { receivedRatingsReadSchema, receivedRatingSummary } from "../domain/receivedRatings.js";

describe("private received ratings summary", () => {
  it("keeps no reviews distinct from a fabricated zero or five-star rating", () => {
    expect(receivedRatingSummary("parent", 0, null)).toEqual({ userId: "parent", count: 0, average: null });
    expect(receivedRatingSummary("driver", 107, 429 / 107)).toEqual({ userId: "driver", count: 107, average: 429 / 107 });
  });
  it.each([[-1, null], [1.5, 4], [NaN, 4], [Infinity, 4], [Number.MAX_SAFE_INTEGER + 1, 4],
    [0, 0], [0, 5], [1, null], [1, 0], [1, 6], [1, NaN], [1, Infinity], [1, "4"], ["1", 4]])(
    "rejects invalid count/average %s / %s", (count, average) => {
      expect(() => receivedRatingSummary("parent", count, average)).toThrow();
    },
  );
  it("does not accept another account, pagination limits or a detailed-review request", () => {
    expect(receivedRatingsReadSchema.parse({})).toEqual({});
    for (const value of [{userId: "other"}, {limit: 100}, {includeComments: true}, null, []])
      expect(receivedRatingsReadSchema.safeParse(value).success).toBe(false);
  });
});
