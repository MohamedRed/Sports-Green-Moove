import Foundation

func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() {
        fatalError(message)
    }
}

let now = Date(timeIntervalSince1970: 1_700_000_000)
check(TripStatePolicy.status(now: now, departure: now.addingTimeInterval(-1)) == .past, "Past departure should be past")
check(TripStatePolicy.status(now: now, departure: now) == .upcoming, "Current departure should be upcoming")
check(TripStatePolicy.status(now: now, departure: nil) == .upcoming, "Missing departure should be upcoming")

let missing = ActiveRidePermissionPolicy.missingRequirements(
    ActiveRidePermissionSnapshot(
        hasForegroundLocation: true,
        hasBackgroundLocation: false,
        hasNotifications: false
    )
)
check(missing == [.backgroundLocation, .notifications], "Permission ordering or requirements changed")
check(
    !ActiveRidePermissionPolicy.canStartActiveRide(
        ActiveRidePermissionSnapshot(
            hasForegroundLocation: true,
            hasBackgroundLocation: false,
            hasNotifications: true
        )
    ),
    "Background location is required for active rides"
)
check(
    ActiveRidePermissionPolicy.canStartActiveRide(
        ActiveRidePermissionSnapshot(
            hasForegroundLocation: true,
            hasBackgroundLocation: true,
            hasNotifications: true
        )
    ),
    "All required permissions should allow active rides"
)

let strongMatchScore = NativeMatchingScore.score(
    NativeMatchCandidateSignal(
        detourSeconds: 360,
        detourMeters: 2_000,
        pickupMeters: 800,
        scheduleDeltaMinutes: 4,
        sameClub: true,
        sameTeam: true,
        seatsAvailable: 3,
        seatsNeeded: 1,
        supportsVehicleTracking: true,
        supportsChildTracking: true,
        driverRating: 4.6,
        co2SavedKgEstimate: 3.4,
        priceCents: 250
    )
)
check(abs(strongMatchScore - 135.6) < 0.001, "Native matching score must match backend formula")

let cappedScore = NativeMatchingScore.score(
    NativeMatchCandidateSignal(
        detourSeconds: 1_800,
        detourMeters: 15_000,
        pickupMeters: 6_000,
        scheduleDeltaMinutes: 18,
        sameClub: false,
        sameTeam: false,
        seatsAvailable: 1,
        seatsNeeded: 1,
        supportsVehicleTracking: false,
        supportsChildTracking: false,
        driverRating: 3,
        co2SavedKgEstimate: 0,
        priceCents: 1_400,
        maxDetourMinutes: 10,
        maxPickupDistanceMeters: 2_000
    )
)
check(cappedScore < -100, "Detour and pickup caps should strongly penalize bad matches")

let co2Saved = NativeImpactLedger.estimateCo2SavedKg(distanceMeters: 12_000, passengersSharing: 3)
let balance = NativeImpactLedger.rewardBalanceCents(
    entries: [
        NativeRewardLedgerEntry(userId: "driver-1", amountCents: 38),
        NativeRewardLedgerEntry(userId: "driver-2", amountCents: 12),
        NativeRewardLedgerEntry(userId: "driver-1", amountCents: -5),
    ],
    userId: "driver-1"
)
check(abs(co2Saved - 3.2) < 0.001, "CO2 estimate must match backend contract")
check(NativeImpactLedger.rewardForCo2Saved(co2Saved) == 38, "Reward math must match backend contract")
check(balance == 33, "Reward balance must sum only the requested user")

let json = try NativeLocationBatchUpdate(
    rideSessionId: "ride-1",
    role: "child",
    latitude: 50.8466,
    longitude: 4.3528,
    accuracyM: -1,
    capturedAtMs: 1_700_000_000_123,
    speedMps: 2.5,
    headingDeg: nil
).callableBatchJson()
let data = Data(json.utf8)
guard let payload = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
      let first = payload.first
else {
    fatalError("Location batch JSON should contain one update")
}
check(first["rideSessionId"] as? String == "ride-1", "Location batch rideSessionId changed")
check(first["role"] as? String == "child", "Location batch role changed")
check(first["lat"] as? Double == 50.8466, "Location batch latitude changed")
check(first["lng"] as? Double == 4.3528, "Location batch longitude changed")
check(first["accuracyM"] as? Double == 0, "Location batch accuracy should be non-negative")
check(first["capturedAt"] as? Int == 1_700_000_000_123, "Location batch timestamp changed")
check(first["speedMps"] as? Double == 2.5, "Location batch speed changed")
check(first["headingDeg"] == nil, "Location batch should omit missing heading")

let decodedPolyline = MapRoutePolyline.decode("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
check(decodedPolyline.count == 3, "Google route polyline should decode all points")
check(abs(decodedPolyline[0].lat - 38.5) < 0.00001, "First decoded latitude changed")
check(abs(decodedPolyline[0].lng + 120.2) < 0.00001, "First decoded longitude changed")
check(abs(decodedPolyline[2].lat - 43.252) < 0.00001, "Final decoded latitude changed")
check(abs(decodedPolyline[2].lng + 126.453) < 0.00001, "Final decoded longitude changed")

let routePreview = MapRoutePreview(
    start: MapPoint(lat: 50.716, lng: 4.611),
    end: MapPoint(lat: 50.671, lng: 4.581)
)
check(MapRoutePolyline.points(for: routePreview) == [routePreview.start, routePreview.end], "Missing polyline should use route endpoints")

print("SportsGreenMooveNativeChecks passed")
