import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { NormalizedRadarEvent, RadarRideSignal } from "./radar.js";
import { radarEventToLocationUpdate, radarEventToRideSignal } from "./radar.js";
import { firestore, realtimeDb } from "../lib/firebase.js";
import { writeLiveLocation } from "../lib/liveTrips.js";
import { notifyUsers } from "../lib/notifications.js";

type RideSessionDocument = {
  driverUserId?: string;
  participantUserIds?: string[];
};

export async function reconcileRadarEvent(normalized: NormalizedRadarEvent): Promise<{
  locationWritten: boolean;
  signalWritten: boolean;
}> {
  const update = radarEventToLocationUpdate(normalized);
  if (update) await writeLiveLocation(update);

  const signal = radarEventToRideSignal(normalized);
  if (signal) await writeRadarRideSignal(signal);

  return { locationWritten: Boolean(update), signalWritten: Boolean(signal) };
}

async function writeRadarRideSignal(signal: RadarRideSignal): Promise<void> {
  const rideRef = firestore.collection("rideSessions").doc(signal.rideSessionId);
  const auditRef = rideRef.collection("auditEvents").doc(signal.eventId);
  const auditSnap = await auditRef.get();
  if (auditSnap.exists) return;

  const rideSnap = await rideRef.get();
  const ride = rideSnap.data() as RideSessionDocument | undefined;
  const eventAt = Timestamp.fromMillis(signal.capturedAt);
  const update = {
    source: "radar",
    eventType: signal.eventType,
    action: signal.action ?? null,
    userId: signal.userId ?? null,
    radarStatus: signal.radarStatus ?? null,
    etaSeconds: signal.etaSeconds ?? null,
    etaDistanceMeters: signal.etaDistanceMeters ?? null,
    capturedAt: eventAt,
    recordedAt: Timestamp.now(),
  };

  await auditRef.create(update);
  await rideRef.set({
    lastRadarEvent: update,
    lastRadarEventAt: eventAt,
    lastRadarUserId: signal.userId ?? null,
    lastRadarAction: signal.action ?? null,
    radarStatus: signal.radarStatus ?? signal.action ?? null,
    updatedAt: Timestamp.now(),
    radarEventCount: FieldValue.increment(1),
  }, { merge: true });
  await realtimeDb.ref(`liveTrips/${signal.rideSessionId}/meta/radar`).set({
    action: signal.action ?? null,
    eventType: signal.eventType,
    radarStatus: signal.radarStatus ?? null,
    etaSeconds: signal.etaSeconds ?? null,
    etaDistanceMeters: signal.etaDistanceMeters ?? null,
    updatedAt: Date.now(),
  });

  await notifyRadarParticipants(signal, ride);
}

async function notifyRadarParticipants(signal: RadarRideSignal, ride: RideSessionDocument | undefined): Promise<void> {
  const notification = radarNotification(signal);
  if (!notification || !ride) return;

  const participantUserIds = [...new Set([...(ride.participantUserIds ?? []), ride.driverUserId].filter(
    (userId): userId is string => Boolean(userId && userId !== signal.userId),
  ))];
  await notifyUsers(participantUserIds, { ...notification, sourceId: signal.rideSessionId });
}

function radarNotification(signal: RadarRideSignal): { type: string; title: string; body: string } | null {
  switch (signal.action) {
    case "approaching":
      return { type: "radarApproaching", title: "Arrivée proche", body: "Le trajet approche de sa destination." };
    case "arrived":
      return { type: "radarArrived", title: "Arrivée détectée", body: "Radar a détecté l'arrivée du trajet." };
    case "pickup":
      return { type: "radarPickup", title: "Pickup détecté", body: "Radar a détecté un point de pickup." };
    case "dropoff":
      return { type: "radarDropoff", title: "Dropoff détecté", body: "Radar a détecté un point de dropoff." };
    default:
      return null;
  }
}
