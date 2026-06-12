import { describe, expect, it } from "vitest";
import {
  applySearchAccessScope,
  isGuardianOfChild,
  requestedScopeIsAllowed,
  searchAccessScope,
} from "../domain/searchAccess.js";
import type { SearchRequest } from "../domain/types.js";

const request: SearchRequest = {
  requesterUserId: "parent-1",
  childUserId: "child-1",
  clubId: "club-royal",
  teamId: "team-u8",
  category: "U8",
  desiredDepartureAt: "2026-09-12T14:30:00.000Z",
  origin: { lat: 50.715, lng: 4.612 },
  destination: { lat: 50.67, lng: 4.58 },
  seatsNeeded: 1,
  baggage: "medium",
  returnTrip: false,
  requireChildTracking: true,
  guardianConsent: true,
};

describe("search access scope", () => {
  it("verifies guardian relationship from child documents", () => {
    expect(isGuardianOfChild({ guardianUserIds: ["parent-1"] }, "parent-1")).toBe(true);
    expect(isGuardianOfChild({ guardianUserIds: ["parent-1"] }, "parent-2")).toBe(false);
  });

  it("merges active child and membership club/team scopes", () => {
    const scope = searchAccessScope([
      { clubId: "club-royal", teamId: "team-u8", status: "active" },
      { clubId: "club-revoked", teamId: "team-revoked", status: "revoked" },
    ], {
      guardianUserIds: ["parent-1"],
      clubIds: ["club-biereau"],
      teamIds: ["team-u10"],
    });

    expect(scope.allowedClubIds.sort()).toEqual(["club-biereau", "club-royal"]);
    expect(scope.allowedTeamIds.sort()).toEqual(["team-u10", "team-u8"]);
    expect(scope.enforceMemberships).toBe(true);
  });

  it("prevents client-requested club/team searches outside allowed child scope", () => {
    const scoped = applySearchAccessScope(request, {
      allowedClubIds: ["club-royal"],
      allowedTeamIds: ["team-u8"],
      enforceMemberships: true,
    });

    expect(requestedScopeIsAllowed(scoped)).toBe(true);
    expect(requestedScopeIsAllowed({ ...scoped, teamId: "team-u12" })).toBe(false);
  });
});
