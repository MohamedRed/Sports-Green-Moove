import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func searchTripMatches(criteria: TripSearchCriteria) async throws -> [TripMatchSummary] {
        try Task.checkCancellation()
        guard !criteria.requesterUserId.isEmpty, Auth.auth().currentUser?.uid == criteria.requesterUserId else { throw CancellationError() }
        let matches: [TripMatchSummary] = try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("searchTrips").call(criteria.callablePayload()) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let payload = result?.data as? [String: Any],
                      let matches = payload["matches"] as? [[String: Any]]
                else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse matching invalide."))
                    return
                }

                do { continuation.resume(returning: try matches.compactMap(mapTripMatch)) }
                catch { continuation.resume(throwing: error) }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == criteria.requesterUserId else { throw CancellationError() }
        return matches
    }
}

private extension TripSearchCriteria {
    func callablePayload() -> [String: Any] {
        var payload: [String: Any] = [
            "desiredDepartureAt": desiredDepartureAtIso,
            "origin": ["lat": origin.lat, "lng": origin.lng],
            "destination": ["lat": destination.lat, "lng": destination.lng],
            "seatsNeeded": seatsNeeded,
            "baggage": baggage,
            "returnTrip": returnTrip,
            "requireChildTracking": requireChildTracking,
            "guardianConsent": guardianConsent,
        ]
        if let childUserId, !childUserId.isEmpty { payload["childUserId"] = childUserId }
        if let clubId, !clubId.isEmpty { payload["clubId"] = clubId }
        if let teamId, !teamId.isEmpty { payload["teamId"] = teamId }
        if let category, !category.isEmpty { payload["category"] = category }
        return payload
    }
}

private func mapTripMatch(_ data: [String: Any]) throws -> TripMatchSummary? {
    guard let tripId = data["tripId"] as? String,
          let summaryData = data["summary"] as? [String: Any]
    else { return nil }

    let route = data["route"] as? [String: Any]
    let detourSeconds = intValue(route?["detourDurationSeconds"])
    let summary = mapClientTripSummary(summaryData, route: route)
    guard summary.id == tripId else { throw BookingIntentError.unavailable }
    return TripMatchSummary(
        tripId: tripId,
        score: doubleValue(data["score"]) ?? 0,
        summary: summary,
        reasons: data["reasons"] as? [String] ?? [],
        detourMinutes: detourSeconds.map { Int(round(Double($0) / 60)) },
        pickupDistanceMeters: intValue(route?["pickupDistanceMeters"])
    )
}

private func mapClientTripSummary(_ data: [String: Any], route: [String: Any]?) -> TripSummary {
    let seats = intValue(data["seatsAvailable"]) ?? 0
    return TripSummary(
        id: data["id"] as? String ?? "",
        title: data["title"] as? String ?? "Trajet sportif",
        club: data["club"] as? String ?? "Club",
        category: data["category"] as? String ?? "",
        sport: data["sport"] as? String ?? "Football",
        departureLabel: data["departureLabel"] as? String ?? "Date à confirmer",
        dateLabel: data["dateLabel"] as? String ?? "DATE À CONFIRMER",
        timeLabel: data["timeLabel"] as? String ?? "--h--",
        distanceLabel: data["distanceLabel"] as? String ?? "Distance à confirmer",
        seatsAvailable: seats,
        seatsLabel: data["seatsLabel"] as? String,
        priceLabel: data["priceLabel"] as? String ?? "Gratuit",
        passengerInitials: data["passengerInitials"] as? [String] ?? [],
        reasons: data["reasons"] as? [String] ?? [],
        status: TripStatus(rawValue: data["status"] as? String ?? "") ?? .upcoming,
        mapPreview: mapRoutePreviewFromMatchData(summary: data, route: route),
        bookingIntent: (data["bookingIntent"] as? [String: Any]).flatMap(BookingIntentSnapshot.fromPayload)
    )
}

private func intValue(_ value: Any?) -> Int? {
    if let int = value as? Int { return int }
    if let number = value as? NSNumber { return number.intValue }
    if let double = value as? Double { return Int(double) }
    return nil
}

private func doubleValue(_ value: Any?) -> Double? {
    if let double = value as? Double { return double }
    if let number = value as? NSNumber { return number.doubleValue }
    if let int = value as? Int { return Double(int) }
    return nil
}
#endif
