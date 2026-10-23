import { describe, expect, it } from "vitest";
import { bookingNotificationId } from "../domain/bookingNotifications.js";

describe("booking notification identities", () => {
  it("keeps a stable notice for an exact booking decision and recipient", () => {
    expect(bookingNotificationId("bookingApproved", "booking", "parent"))
      .toBe(bookingNotificationId("bookingApproved", "booking", "parent"));
    expect(bookingNotificationId("bookingApproved", "booking", "parent")).toMatch(/^bookingDecision_[a-f0-9]{64}$/);
  });
  it("separates recipients, bookings and distinct decisions", () => {
    const ids = [bookingNotificationId("bookingApproved", "booking", "parent"),
      bookingNotificationId("bookingApproved", "booking", "driver"),
      bookingNotificationId("bookingApproved", "other", "parent"),
      bookingNotificationId("bookingDeclined", "booking", "parent"),
      bookingNotificationId("bookingCancelled", "booking", "parent"),
      bookingNotificationId("bookingRequested", "booking", "driver")];
    expect(new Set(ids).size).toBe(6);
    expect(bookingNotificationId("bookingRequested", "booking", "driver"))
      .toBe(bookingNotificationId("bookingRequested", "booking", "driver"));
  });
  it("does not confuse embedded separators or document-path characters", () => {
    expect(bookingNotificationId("bookingApproved", "a:b", "c"))
      .not.toBe(bookingNotificationId("bookingApproved", "a", "b:c"));
    expect(bookingNotificationId("bookingApproved", "a/b", "user/id")).toMatch(/^bookingDecision_[a-f0-9]{64}$/);
  });
});
