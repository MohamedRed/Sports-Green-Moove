const rideNotificationTypes = new Set([
  "passengerPickedUp",
  "passengerDroppedOff",
  "radarApproaching",
  "radarArrived",
  "radarPickup",
  "radarDropoff",
]);

export async function loadRideAuditNotifications(db, rideSessions) {
  const collection = db.collection("notifications");
  const snapshots = await Promise.all(rideSessions.map(({ id }) => collection.where("sourceId", "==", id)
    .select("sourceId", "userId", "type", "read", "createdAt", "readAt")
    .get()));
  return snapshots.flatMap(({ docs }) => docs.map((doc) => ({ id: doc.id, data: doc.data() })));
}

export function selectRideAuditNotifications(rideSessions, notifications) {
  const recipients = new Map(rideSessions.map(({ id, data = {} }) => [
    id,
    new Set([
      data.driverUserId,
      ...(data.participantUserIds ?? []),
      ...(data.passengers ?? []).map(({ parentUserId }) => parentUserId),
    ].filter((uid) => typeof uid === "string" && uid.length > 0)),
  ]));
  return notifications.filter(({ data }) => rideNotificationTypes.has(data?.type)
    && recipients.get(data.sourceId)?.has(data.userId));
}
