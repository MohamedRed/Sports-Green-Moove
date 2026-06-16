export async function seedChildProfile({ admin, runId, parent, child, created }) {
  await admin.firestore().collection("children").doc(child.uid).set({
    displayName: "Codex Child",
    guardianUserIds: [parent.uid],
    clubIds: [`${runId}-club`],
    teamIds: [`${runId}-team`],
    trackingEnabled: true,
    guardianConsent: true,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  created.childIds.push(child.uid);
  return child.uid;
}

export async function verifyNativeFallbackTracking({ admin, callFunction, assert, parent, driver, child, rideSessionId }) {
  const now = Date.now();
  const driverLocation = await callFunction("writeLocationBatch", driver.idToken, {
    updates: [{
      rideSessionId,
      role: "driver",
      lat: 50.80112,
      lng: 4.39731,
      accuracyM: 12,
      speedMps: 8.4,
      headingDeg: 135,
      batteryPct: 88,
      capturedAt: now,
    }],
  });
  assert(driverLocation.written === 1, "writeLocationBatch did not write the driver location.");

  const childLocation = await callFunction("writeLocationBatch", child.idToken, {
    updates: [{
      rideSessionId,
      role: "child",
      lat: 50.79244,
      lng: 4.41198,
      accuracyM: 18,
      batteryPct: 71,
      capturedAt: now + 1000,
    }],
  });
  assert(childLocation.written === 1, "writeLocationBatch did not write the child location.");

  const activeForParent = await callFunction("getActiveRide", parent.idToken);
  assert(activeForParent.ride?.rideSessionId === rideSessionId, "Parent could not read the active ride.");
  assert(
    activeForParent.ride?.childLastUpdateLabel?.includes("Secours GPS"),
    "Parent active ride did not expose child native fallback status.",
  );

  const activeForChild = await callFunction("getActiveRide", child.idToken);
  assert(activeForChild.ride?.rideSessionId === rideSessionId, "Child could not read the active ride.");

  const liveChild = (await admin.database().ref(`liveTrips/${rideSessionId}/children/${child.uid}`).get()).val();
  assert(liveChild?.source === "nativeFallback", "Child native fallback point was not written to liveTrips.");
}
