import { describe, expect, it } from "vitest";
import { childDisplayLabel } from "../domain/children.js";

describe("child profile helpers", () => {
  it("uses the first available child display label", () => {
    expect(childDisplayLabel({ displayName: "Kévin" }, "child-1")).toBe("Kévin");
    expect(childDisplayLabel({ name: "Léo" }, "child-2")).toBe("Léo");
    expect(childDisplayLabel({ firstName: "Nora" }, "child-3")).toBe("Nora");
  });

  it("falls back to a deterministic child id label", () => {
    expect(childDisplayLabel({}, "child-1234")).toBe("Enfant 1234");
  });
});
