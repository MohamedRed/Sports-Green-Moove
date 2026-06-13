import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import FirebaseFunctions

@MainActor
enum AppRuntime {
    static func makeAppState() -> AppState {
        if FirebaseApp.app() == nil, Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }

        guard FirebaseApp.app() != nil else {
            return AppState(auth: UnconfiguredAuthGateway(), firebase: UnconfiguredFirebaseGateway())
        }

        return AppState(
            auth: FirebaseAuthGateway(),
            firebase: FirebaseBackendGateway(),
            radar: FirebaseRadarTrackingGateway(publishableKey: NativeRadarConfiguration.publishableKey),
            stripe: FirebaseStripePaymentsGateway()
        )
    }
}

struct FirebaseBackendGateway: FirebaseGateway {
    let isConfigured = true

    func searchTrips() async throws -> [TripSummary] {
        let query = Firestore.firestore()
            .collection("trips")
            .whereField("status", isEqualTo: "published")
            .order(by: "departureAt")
            .limit(to: 30)
        return try await trips(for: query)
    }

    func requestBooking(tripId: String, childId: String?) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            var data: [String: Any] = ["tripId": tripId, "seats": 1]
            if let childId, !childId.isEmpty {
                data["childId"] = childId
            }
            Functions.functions().httpsCallable("requestBooking").call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let bookingId = payload["bookingId"] as? String {
                    continuation.resume(returning: bookingId)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse booking invalide."))
                }
            }
        }
    }

    func startRide(tripId: String, bookingIds: [String]) async throws -> LiveRideSnapshot {
        try await withCheckedThrowingContinuation { continuation in
            let data: [String: Any] = ["tripId": tripId, "bookingIds": bookingIds]
            Functions.functions().httpsCallable("startRide").call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let ride = payload["ride"] as? [String: Any] {
                    continuation.resume(returning: mapRide(ride))
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse ride invalide."))
                }
            }
        }
    }

    func markPickup(rideSessionId: String, bookingId: String, childId: String) async throws -> String {
        try await markPassengerStatus("markPickup", rideSessionId: rideSessionId, bookingId: bookingId, childId: childId)
    }

    func markDropoff(rideSessionId: String, bookingId: String, childId: String) async throws -> String {
        try await markPassengerStatus("markDropoff", rideSessionId: rideSessionId, bookingId: bookingId, childId: childId)
    }

    private func markPassengerStatus(
        _ callable: String,
        rideSessionId: String,
        bookingId: String,
        childId: String
    ) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            let data: [String: Any] = [
                "rideSessionId": rideSessionId,
                "bookingId": bookingId,
                "childId": childId,
            ]
            Functions.functions().httpsCallable(callable).call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let status = payload["status"] as? String {
                    continuation.resume(returning: status)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse statut passager invalide."))
                }
            }
        }
    }

    func endRide(rideSessionId: String, distanceMeters: Int, passengersSharing: Int) async throws -> RideCompletionSummary {
        try await withCheckedThrowingContinuation { continuation in
            let data: [String: Any] = [
                "rideSessionId": rideSessionId,
                "distanceMeters": distanceMeters,
                "passengersSharing": passengersSharing,
            ]
            Functions.functions().httpsCallable("endRide").call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any] {
                    continuation.resume(returning: RideCompletionSummary(
                        rideSessionId: payload["rideSessionId"] as? String ?? rideSessionId,
                        co2SavedKg: (payload["co2SavedKg"] as? NSNumber)?.doubleValue ?? 0,
                        rewardCents: (payload["rewardCents"] as? NSNumber)?.intValue ?? 0
                    ))
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse fin de course invalide."))
                }
            }
        }
    }

    func getActiveRide() async throws -> LiveRideSnapshot? {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("getActiveRide").call([:]) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let ride = payload["ride"] as? [String: Any] {
                    continuation.resume(returning: mapRide(ride))
                } else {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    func getPayableBookings() async throws -> [PayableBookingSummary] {
        guard let uid = Auth.auth().currentUser?.uid else { return [] }
        let snapshot = try await documents(for: Firestore.firestore()
            .collection("bookings")
            .whereField("parentUserId", isEqualTo: uid)
            .limit(to: 30))

        var bookings: [PayableBookingSummary] = []
        for document in snapshot {
            let booking = document.data()
            guard booking["status"] as? String == "approved",
                  booking["paymentStatus"] as? String != "paid",
                  let tripId = booking["tripId"] as? String,
                  let trip = try await documentData(collection: "trips", id: tripId),
                  let summary = mapPayableBooking(id: document.documentID, booking: booking, trip: trip)
            else { continue }
            bookings.append(summary)
        }
        return bookings
    }

    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws {
        #if os(iOS) && canImport(CoreLocation)
        let locationRole = role == .child ? "child" : "driver"
        try await NativeLocationFallbackProvider.shared.startContinuousUpdates(
            rideSessionId: rideSessionId,
            role: locationRole
        ) { update in
            try await uploadNativeLocationUpdate(update)
        }
        #else
        _ = (rideSessionId, role)
        throw ProviderConfigurationError(message: "Core Location iOS n'est pas disponible.")
        #endif
    }

    func stopNativeLocationFallback(rideSessionId: String) {
        #if os(iOS) && canImport(CoreLocation)
        Task { @MainActor in
            NativeLocationFallbackProvider.shared.stopContinuousUpdates(rideSessionId: rideSessionId)
        }
        #else
        _ = rideSessionId
        #endif
    }

    #if os(iOS) && canImport(CoreLocation)
    private func uploadNativeLocationUpdate(_ update: NativeLocationFallbackUpdate) async throws {
        let updatesJson = try update.callableBatchJson()
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Functions.functions().httpsCallable("writeLocationBatch").call(["updatesJson": updatesJson]) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let written = payload["written"] as? Int,
                          written > 0 {
                    continuation.resume(returning: ())
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse localisation invalide."))
                }
            }
        }
    }
    #endif

    private func trips(for query: Query) async throws -> [TripSummary] {
        let snapshot = try await documents(for: query)
        return snapshot.map { mapTrip(id: $0.documentID, data: $0.data()) }
    }

    private func documents(for query: Query) async throws -> [QueryDocumentSnapshot] {
        try await withCheckedThrowingContinuation { continuation in
            query.getDocuments { snapshot, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let snapshot {
                    continuation.resume(returning: snapshot.documents)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse Firestore invalide."))
                }
            }
        }
    }

    private func documentData(collection: String, id: String) async throws -> [String: Any]? {
        try await withCheckedThrowingContinuation { continuation in
            Firestore.firestore().collection(collection).document(id).getDocument { snapshot, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: snapshot?.data())
                }
            }
        }
    }
}

#else
@MainActor
enum AppRuntime {
    static func makeAppState() -> AppState {
        AppState(auth: UnconfiguredAuthGateway(), firebase: UnconfiguredFirebaseGateway())
    }
}
#endif
