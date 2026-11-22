import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
import FirebaseAuth

extension FirebaseBackendGateway {
    func requestBooking(uid: String, trip: TripSummary, childId: String?, seats: Int) async throws -> String {
        try Task.checkCancellation()
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw BookingRecoveryError.accountChanged }
        _ = try bookingRequestPayload(trip: trip, childId: childId, seats: seats)
        guard let terms = trip.bookingIntent else { throw BookingIntentError.unavailable }
        let coordinator = BookingRequestCoordinator(store: try PendingBookingStore.platformStore(),
            transport: FirebaseBookingRequestTransport(), currentUid: { Auth.auth().currentUser?.uid == uid ? uid : nil })
        return try await coordinator.request(PendingBookingIntent(tripId: trip.id, childId: childId, seats: seats, terms: terms))
    }
    func approveBooking(uid: String, bookingId: String) async throws -> String {
        try await firebaseOwnedCall(uid: uid, name: "approveBooking", input: ["bookingId": bookingId]) { value in
            guard let payload = value as? [String: Any], let status = payload["status"] as? String else {
                throw ProviderConfigurationError(message: "Impossible de vérifier l’approbation. Réessayez.")
            }
            return status
        }
    }
}
#endif
