import { HttpsError } from "firebase-functions/v2/https";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { locationBatchRequestSchema } from "../domain/locationBatch.js";
import { parseCallableData, validationErrorMessage } from "../lib/validation.js";

describe("callable validation", () => {
  it("returns parsed data for valid callable payloads", () => {
    const schema = z.object({ reportId: z.string().min(1), status: z.enum(["reviewing", "closed"]) });

    expect(parseCallableData(schema, { reportId: "report-1", status: "closed" })).toEqual({
      reportId: "report-1",
      status: "closed",
    });
  });

  it("maps invalid callable payloads to invalid-argument errors", () => {
    const schema = z.object({ reportId: z.string().min(1), status: z.enum(["reviewing", "closed"]) });

    expect(() => parseCallableData(schema, { reportId: "report-1", status: "resolved" }))
      .toThrow(HttpsError);

    try {
      parseCallableData(schema, { reportId: "report-1", status: "resolved" });
      throw new Error("Expected parseCallableData to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpsError);
      expect((error as HttpsError).code).toBe("invalid-argument");
      expect((error as HttpsError).message).toContain("status");
    }
  });

  it("maps invalid JSON location batches to invalid-argument errors", () => {
    try {
      parseCallableData(locationBatchRequestSchema, { updatesJson: JSON.stringify([{ role: "driver" }]) });
      throw new Error("Expected parseCallableData to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpsError);
      expect((error as HttpsError).code).toBe("invalid-argument");
    }
  });

  it("formats validation messages with field paths", () => {
    const result = z.object({ bookingId: z.string().min(1) }).safeParse({ bookingId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(validationErrorMessage(result.error)).toContain("bookingId");
    }
  });
});
