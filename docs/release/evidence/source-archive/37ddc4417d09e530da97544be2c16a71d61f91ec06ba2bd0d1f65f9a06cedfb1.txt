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

                do { continuation.resume(returning: try TripSearchWire.matches(result?.data as Any, seatsNeeded: criteria.seatsNeeded)) }
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

#endif
