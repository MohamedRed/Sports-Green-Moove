import { describe, expect, it } from "vitest";
import { normalizeReportReviewNote, reportClosedAtValue } from "../domain/reports.js";

describe("report review domain helpers", () => {
  it("normalizes blank review notes to null", () => {
    expect(normalizeReportReviewNote("  Escalated to support lead. ")).toBe("Escalated to support lead.");
    expect(normalizeReportReviewNote("   ")).toBeNull();
    expect(normalizeReportReviewNote(undefined)).toBeNull();
  });

  it("sets closedAt only for closed reports", () => {
    expect(reportClosedAtValue("closed", "reviewed-at")).toBe("reviewed-at");
    expect(reportClosedAtValue("reviewing", "reviewed-at")).toBeNull();
    expect(reportClosedAtValue("open", "reviewed-at")).toBeNull();
  });
});
