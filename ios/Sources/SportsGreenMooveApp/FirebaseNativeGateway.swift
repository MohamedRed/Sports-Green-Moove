import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
@preconcurrency import FirebaseFunctions

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
            stripe: FirebaseStripePaymentsGateway()
        )
    }
}

private struct FirebaseAuthGateway: AuthGateway {
    let isConfigured = true

    func currentSession() async throws -> AuthSession? {
        guard let user = Auth.auth().currentUser else { return nil }
        return AuthSession(uid: user.uid, email: user.email)
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        return try await authSession { completion in
            Auth.auth().signIn(withEmail: email, password: password, completion: completion)
        }
    }

    func signUp(name: String, email: String, password: String) async throws -> AuthSession {
        _ = name
        return try await authSession { completion in
            Auth.auth().createUser(withEmail: email, password: password, completion: completion)
        }
    }

    func signOut() throws {
        try Auth.auth().signOut()
    }

    private func authSession(_ action: (@escaping (AuthDataResult?, Error?) -> Void) -> Void) async throws -> AuthSession {
        try await withCheckedThrowingContinuation { continuation in
            action { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let result {
                    let session = AuthSession(uid: result.user.uid, email: result.user.email)
                    continuation.resume(returning: session)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse Firebase Auth invalide."))
                }
            }
        }
    }
}

private struct FirebaseBackendGateway: FirebaseGateway {
    let isConfigured = true

    func searchTrips() async throws -> [TripSummary] {
        let query = Firestore.firestore()
            .collection("trips")
            .whereField("status", isEqualTo: "published")
            .order(by: "departureAt")
            .limit(to: 30)
        return try await trips(for: query)
    }

    func requestBooking(tripId: String) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            let data: [String: Any] = ["tripId": tripId, "seats": 1]
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

    func startRide(tripId: String) async throws -> LiveRideSnapshot {
        try await withCheckedThrowingContinuation { continuation in
            let data: [String: Any] = ["tripId": tripId, "bookingIds": []]
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

    func writeNativeLocationFallback(rideSessionId: String, role: AppRole) async throws {
        #if os(iOS) && canImport(CoreLocation)
        let locationRole = role == .child ? "child" : "driver"
        let update = try await NativeLocationFallbackProvider.shared.currentLocationUpdate(
            rideSessionId: rideSessionId,
            role: locationRole
        )
        let payload = update.callablePayload()
        let requestPayload = NSDictionary(dictionary: ["updates": NSArray(object: payload)])
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Functions.functions().httpsCallable("writeLocationBatch").call(requestPayload) { result, error in
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
        #else
        _ = (rideSessionId, role)
        throw ProviderConfigurationError(message: "Core Location iOS n'est pas disponible.")
        #endif
    }

    private func trips(for query: Query) async throws -> [TripSummary] {
        try await withCheckedThrowingContinuation { continuation in
            query.getDocuments { snapshot, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let snapshot {
                    let trips = snapshot.documents.map { mapTrip(id: $0.documentID, data: $0.data()) }
                    continuation.resume(returning: trips)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse Firestore invalide."))
                }
            }
        }
    }
}

private func mapTrip(id: String, data: [String: Any]) -> TripSummary {
    let departure = dateValue(data["departureAt"])
    let dateLabel = departure.map(formatDateLabel) ?? "DATE À CONFIRMER"
    let timeLabel = departure.map(formatTimeLabel) ?? "--h--"
    let seats = data["seatsAvailable"] as? Int ?? 0
    let distance = data["distanceKm"] as? Double

    return TripSummary(
        id: id,
        title: data["title"] as? String ?? "\(data["category"] as? String ?? "Trajet") sportif",
        club: data["clubName"] as? String ?? data["clubId"] as? String ?? "Club",
        category: data["category"] as? String ?? "",
        sport: data["sport"] as? String ?? "Football",
        departureLabel: "\(dateLabel.replacingOccurrences(of: #"^[A-ZÀ-ÿ]{3}\\s"#, with: "", options: .regularExpression)) · \(timeLabel)",
        dateLabel: dateLabel,
        timeLabel: timeLabel,
        distanceLabel: distance.map { String(format: "%.1f km", $0) } ?? "Distance à confirmer",
        seatsAvailable: seats,
        priceLabel: priceLabel(data["priceCents"] as? Int ?? 0),
        passengerInitials: data["passengerInitials"] as? [String] ?? [],
        reasons: ["\(seats) \(seats > 1 ? "places" : "place")", "Suivi véhicule disponible"],
        status: departure.map { $0 < Date() ? .past : .upcoming } ?? .upcoming
    )
}

private func mapRide(_ data: [String: Any]) -> LiveRideSnapshot {
    LiveRideSnapshot(
        rideSessionId: data["rideSessionId"] as? String ?? "",
        status: data["status"] as? String ?? "Actif",
        vehicleLastUpdateLabel: data["vehicleLastUpdateLabel"] as? String ?? "En attente du premier point GPS",
        childLastUpdateLabel: data["childLastUpdateLabel"] as? String,
        etaLabel: data["etaLabel"] as? String ?? "ETA à calculer",
        stale: data["stale"] as? Bool ?? true
    )
}

private func dateValue(_ value: Any?) -> Date? {
    if let timestamp = value as? Timestamp { return timestamp.dateValue() }
    if let date = value as? Date { return date }
    if let text = value as? String { return ISO8601DateFormatter().date(from: text) }
    return nil
}

private func formatDateLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_BE")
    formatter.dateFormat = "EEE dd MMM"
    return formatter.string(from: date).replacingOccurrences(of: ".", with: "").uppercased()
}

private func formatTimeLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_BE")
    formatter.dateFormat = "HH'h'mm"
    return formatter.string(from: date)
}

private func priceLabel(_ cents: Int) -> String {
    guard cents > 0 else { return "Gratuit" }
    return String(format: "%.2f EUR", Double(cents) / 100).replacingOccurrences(of: ".", with: ",")
}
#else
@MainActor
enum AppRuntime {
    static func makeAppState() -> AppState {
        AppState(auth: UnconfiguredAuthGateway(), firebase: UnconfiguredFirebaseGateway())
    }
}
#endif
