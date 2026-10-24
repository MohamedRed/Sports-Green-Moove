const documentCollections = {
  messageIds: "messages",
  ratingIds: "ratings",
  notificationIds: "notifications",
  co2LedgerIds: "co2Ledger",
  rewardLedgerIds: "rewardLedger",
  childIds: "children",
  bookingIds: "bookings",
  tripIds: "trips",
  userDocIds: "users",
};

export async function cleanupLiveSmoke({ admin, created }) {
  const db = admin.firestore();
  const failures = [];
  const attempt = async (label, operation) => {
    try {
      await operation();
    } catch {
      failures.push(label);
    }
  };

  await Promise.all([...new Set(created.authUserIds)].map((uid) => attempt(
    `notifications lookup for ${uid}`,
    async () => {
      const snapshot = await db.collection("notifications").where("userId", "==", uid).get();
      created.notificationIds.push(...snapshot.docs.map((doc) => doc.id));
    },
  )));

  // Only delete resources recorded for this disposable run, including nested audits.
  const deletions = [];
  for (const [key, collection] of Object.entries(documentCollections)) {
    for (const id of new Set(created[key])) {
      deletions.push(attempt(`${collection}/${id}`, () => db.collection(collection).doc(id).delete()));
    }
  }
  for (const id of new Set(created.rideSessionIds)) {
    deletions.push(attempt(`rideSessions/${id}`, () => db.recursiveDelete(db.collection("rideSessions").doc(id))));
    deletions.push(attempt(`liveTrips/${id}`, () => admin.database().ref(`liveTrips/${id}`).remove()));
  }
  await Promise.all(deletions);

  const userIds = [...new Set(created.authUserIds)];
  if (userIds.length) {
    await attempt("auth users", async () => {
      const result = await admin.auth().deleteUsers(userIds);
      if (result.failureCount > 0) {
        for (const failure of result.errors) {
          failures.push(`auth user ${userIds[failure.index]}`);
        }
        if (!result.errors.length) failures.push("auth user deletion incomplete");
      }
    });
  }
  if (failures.length) {
    throw new Error(`Live smoke cleanup incomplete: ${failures.join(", ")}.`);
  }
}

export async function runWithSmokeCleanup({ run, cleanup, dispose }) {
  const failures = [];
  let result;
  try {
    result = await run();
  } catch (error) {
    failures.push(error);
  }
  for (const operation of [cleanup, dispose]) {
    try {
      await operation();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Live smoke and cleanup failed.");
  return result;
}
