import { Timestamp } from "firebase-admin/firestore";
import { canReadRide } from "../domain/access.js";
import { roleKeysFromToken } from "../domain/roles.js";
import { firestore } from "./firebase.js";

export type RidePassengerDocument = {
  bookingId: string;
  childId: string;
  label: string;
  parentUserId?: string;
  pickupStatus: "pending" | "pickedUp";
  dropoffStatus: "pending" | "droppedOff";
};

export type RideSessionDocument = {
  tripId?: string;
  bookingIds?: string[];
  driverUserId?: string;
  participantUserIds?: string[];
  childUserIds?: string[];
  passengers?: RidePassengerDocument[];
  passengerStatuses?: Record<string, {
    pickupStatus?: string;
    dropoffStatus?: string;
  }>;
  startedAt?: Timestamp;
  status?: string;
};

export async function loadAccessibleActiveRide(
  uid: string,
  token: unknown,
): Promise<{ id: string; ride: RideSessionDocument } | null> {
  const roleKeys = roleKeysFromToken(token);
  const queries = [
    firestore.collection("rideSessions")
      .where("driverUserId", "==", uid)
      .where("status", "==", "active")
      .orderBy("startedAt", "desc")
      .limit(5)
      .get(),
    firestore.collection("rideSessions")
      .where("participantUserIds", "array-contains", uid)
      .where("status", "==", "active")
      .orderBy("startedAt", "desc")
      .limit(5)
      .get(),
    firestore.collection("rideSessions")
      .where("childUserIds", "array-contains", uid)
      .where("status", "==", "active")
      .orderBy("startedAt", "desc")
      .limit(5)
      .get(),
  ];
  if (roleKeys.includes("admin")) {
    queries.push(firestore.collection("rideSessions")
      .where("status", "==", "active")
      .orderBy("startedAt", "desc")
      .limit(10)
      .get());
  }

  const snapshots = await Promise.all(queries);

  const candidates = snapshots
    .flatMap((snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ride: doc.data() as RideSessionDocument })))
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index)
    .filter(({ ride }) => ride.status === "active" && canReadRide(uid, roleKeys, ride))
    .sort((a, b) => startedAtMillis(b.ride) - startedAtMillis(a.ride));

  return candidates[0] ?? null;
}

function startedAtMillis(ride: RideSessionDocument): number {
  return ride.startedAt?.toMillis?.() ?? 0;
}
