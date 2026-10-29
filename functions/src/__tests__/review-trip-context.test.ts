import { describe, expect, it } from "vitest";
import { attachReviewTripContexts, pendingReviewTripIds } from "../domain/reviewTripContext.js";
import { buildInboxReviewPrompts } from "../domain/inbox.js";

const ride = {id: "ride", data: {tripId: "trip", status: "completed", driverUserId: "driver", participantUserIds: ["parent"]}};
const trip = {id: "trip", data: {status: "completed", driverUserId: "driver", activeRideSessionId: "ride",
  title: "Entraînement U12", departureAt: "2026-10-29T17:45:00Z", origin: {lat: 0, lng: 0}, privateNote: "never returned"}};
const items = () => buildInboxReviewPrompts([ride], new Set(), "parent");

describe("pending review trip context", () => {
  it("adds only the actual completed trip title and Brussels departure, without changing the review target", () => {
    const result = attachReviewTripContexts(items(), [ride], [trip]);
    expect(result[0]).toEqual({...items()[0], tripContext: {tripId: "trip", title: "Entraînement U12",
      departureAt: "2026-10-29T17:45:00Z", departureLabel: "29 octobre 2026 à 18:45"}});
    expect(JSON.stringify(result)).not.toMatch(/origin|privateNote|never returned/);
  });
  it("resolves distinct selected trips only, leaving scan-only and invalid document paths unread", () => {
    const rows = [ride, {...ride, id: "other", data: {...ride.data, tripId: "unselected"}},
      {...ride, id: "bad", data: {...ride.data, tripId: "private/nested/path"}},
      {...ride, id: "same", data: {...ride.data}}];
    const prompts = buildInboxReviewPrompts(rows.filter(row => row.id !== "other"), new Set(), "parent");
    expect(pendingReviewTripIds(prompts, rows)).toEqual(["trip"]);
  });
  it("uses summer time and includes the local date when UTC crosses midnight", () => {
    const data = {...trip.data, departureAt: "2026-06-01T22:30:00Z"};
    expect(attachReviewTripContexts(items(), [ride], [{...trip, data}])[0].tripContext?.departureLabel).toBe("02 juin 2026 à 00:30");
  });
  for (const [name, data] of [
    ["wrong driver", {...trip.data, driverUserId: "foreign"}],
    ["wrong ride", {...trip.data, activeRideSessionId: "other"}],
    ["unfinished trip", {...trip.data, status: "published"}],
    ["missing date", {...trip.data, departureAt: undefined}],
    ["invalid date", {...trip.data, departureAt: "not-a-date"}],
    ["zone-free date", {...trip.data, departureAt: "2026-10-29T17:45:00"}],
    ["missing title", {...trip.data, title: undefined}],
  ] as const) it(`returns an explicit unavailable context for ${name}, never a fabricated date or dropped request`, () => {
    expect(attachReviewTripContexts(items(), [ride], [{id: "trip", data}])).toEqual([{...items()[0], tripContext: null}]);
  });
  it("keeps reviews whose original trip has been deleted, and does not guess another source", () => {
    expect(attachReviewTripContexts(items(), [ride], [])[0]).toEqual({...items()[0], tripContext: null});
  });
});
