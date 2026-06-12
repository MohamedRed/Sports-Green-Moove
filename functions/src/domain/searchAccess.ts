import type { SearchRequest } from "./types.js";

export type ChildAccessDocument = {
  guardianUserIds?: unknown;
  clubIds?: unknown;
  teamIds?: unknown;
};

type MembershipAccessDocument = {
  clubId?: unknown;
  teamId?: unknown;
  status?: unknown;
  active?: unknown;
};

export type SearchAccessScope = {
  allowedClubIds: string[];
  allowedTeamIds: string[];
  enforceMemberships: boolean;
};

export function isGuardianOfChild(child: ChildAccessDocument | undefined, uid: string): boolean {
  return stringArray(child?.guardianUserIds).includes(uid);
}

export function searchAccessScope(
  memberships: readonly MembershipAccessDocument[],
  child?: ChildAccessDocument,
): SearchAccessScope {
  const clubIds = new Set<string>(stringArray(child?.clubIds));
  const teamIds = new Set<string>(stringArray(child?.teamIds));

  for (const membership of memberships) {
    if (!isActiveMembership(membership)) continue;
    const clubId = stringValue(membership.clubId);
    const teamId = stringValue(membership.teamId);
    if (clubId) clubIds.add(clubId);
    if (teamId) teamIds.add(teamId);
  }

  return {
    allowedClubIds: [...clubIds],
    allowedTeamIds: [...teamIds],
    enforceMemberships: Boolean(child),
  };
}

export function applySearchAccessScope(request: SearchRequest, scope: SearchAccessScope): SearchRequest {
  return {
    ...request,
    allowedClubIds: scope.allowedClubIds,
    allowedTeamIds: scope.allowedTeamIds,
    enforceMemberships: scope.enforceMemberships,
  };
}

export function requestedScopeIsAllowed(request: SearchRequest): boolean {
  if (request.clubId && request.allowedClubIds && !request.allowedClubIds.includes(request.clubId)) return false;
  if (request.teamId && request.allowedTeamIds && !request.allowedTeamIds.includes(request.teamId)) return false;
  return true;
}

function isActiveMembership(membership: MembershipAccessDocument): boolean {
  if (membership.active === false) return false;
  const status = stringValue(membership.status);
  return status !== "inactive" && status !== "revoked" && status !== "blocked";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
