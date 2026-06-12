import type { LocationUpdate } from "./types.js";

export type LocationAccessRideSession = {
  driverUserId?: string;
  participantUserIds?: string[];
  childUserIds?: string[];
  status?: string;
};

export function canWriteLiveLocation(
  uid: string,
  update: Pick<LocationUpdate, "role">,
  ride: LocationAccessRideSession,
): boolean {
  if (ride.status !== "active") return false;

  if (update.role === "driver") {
    return ride.driverUserId === uid;
  }

  return Boolean(ride.childUserIds?.includes(uid) || ride.participantUserIds?.includes(uid));
}
