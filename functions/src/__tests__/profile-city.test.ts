import { describe, expect, it } from "vitest";
import { profileCityFingerprint, profileCityLabelSchema, profileCityReadSchema, profileCityWriteSchema } from "../domain/profileCity.js";

const input = { city: "Liège", expectedRevision: 0, requestId: "26c79c26-cbb6-4bb6-854b-49c04b94ce99" };
describe("own profile city", () => {
  it("normalizes accents and surrounding spaces without resolving a location", () => {
    expect(profileCityLabelSchema.parse(" Lie\u0300ge ")).toBe("Liège");
    for (const city of ["Ottignies-Louvain-la-Neuve", "Bruxelles, Belgique", "'s-Gravenbrakel", "東京"])
      expect(profileCityLabelSchema.parse(city)).toBe(city);
  });
  it("rejects blank, oversized, hidden and directional control text", () => {
    for (const city of ["", " ", "a".repeat(101), "a\nb", "a\u202eb", "\tWavre", "a\u200bb", "a\ufeffb"])
      expect(profileCityLabelSchema.safeParse(city).success).toBe(false);
  });
  it("requires explicit removal rather than storing an empty label", () => {
    expect(profileCityWriteSchema.parse({ ...input, city: null }).city).toBe(null);
    expect(profileCityWriteSchema.safeParse({ ...input, city: " " }).success).toBe(false);
  });
  it("rejects caller-selected owners, roles and search defaults", () => {
    expect(profileCityReadSchema.parse({})).toEqual({});
    for (const field of ["uid", "userId", "roles", "searchOrigin"] ) {
      expect(profileCityReadSchema.safeParse({ [field]: "other" }).success).toBe(false);
      expect(profileCityWriteSchema.safeParse({ ...input, [field]: "other" }).success).toBe(false);
    }
  });
  it("bounds revisions and requires a mutation identity", () => {
    for (const expectedRevision of [-1, 0.5, "0", Infinity, Number.MAX_SAFE_INTEGER])
      expect(profileCityWriteSchema.safeParse({ ...input, expectedRevision }).success).toBe(false);
    expect(profileCityWriteSchema.safeParse({ ...input, requestId: "bad" }).success).toBe(false);
  });
  it("binds retries to the canonical city and displayed revision", () => {
    const first = profileCityWriteSchema.parse(input);
    expect(profileCityFingerprint(first)).toBe(profileCityFingerprint(profileCityWriteSchema.parse({ ...input, city: " Liège " })));
    expect(profileCityFingerprint(first)).not.toBe(profileCityFingerprint({ ...first, city: null }));
    expect(profileCityFingerprint(first)).not.toBe(profileCityFingerprint({ ...first, expectedRevision: 1 }));
  });
});
