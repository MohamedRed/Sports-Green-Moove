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

        return AppState(auth: FirebaseAuthGateway(), firebase: FirebaseBackendGateway())
    }
}

private struct FirebaseAuthGateway: AuthGateway {
    let isConfigured = true

    func currentSession() async throws -> AuthSession? {
        guard let user = Auth.auth().currentUser else { return nil }
        return AuthSession(uid: user.uid, email: user.email)
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        let result = try await authResult { completion in
            Auth.auth().signIn(withEmail: email, password: password, completion: completion)
        }
        return AuthSession(uid: result.user.uid, email: result.user.email)
    }

    func signUp(name: String, email: String, password: String) async throws -> AuthSession {
        _ = name
        let result = try await authResult { completion in
            Auth.auth().createUser(withEmail: email, password: password, completion: completion)
        }
        return AuthSession(uid: result.user.uid, email: result.user.email)
    }

    func signOut() throws {
        try Auth.auth().signOut()
    }

    private func authResult(_ action: (@escaping (AuthDataResult?, Error?) -> Void) -> Void) async throws -> AuthDataResult {
        try await withCheckedThrowingContinuation { continuation in
            action { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let result {
                    continuation.resume(returning: result)
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
        let snapshot = try await documents(for: query)
        return snapshot.documents.map { mapTrip(id: $0.documentID, data: $0.data()) }
    }

    func requestBooking(tripId: String) async throws -> String {
        let result = try await callFunction("requestBooking", data: ["tripId": tripId, "seats": 1])
        guard let bookingId = result["bookingId"] as? String else {
            throw ProviderConfigurationError(message: "Réponse booking invalide.")
        }
        return bookingId
    }

    func startRide(tripId: String) async throws -> LiveRideSnapshot {
        let result = try await callFunction("startRide", data: ["tripId": tripId, "bookingIds": []])
        guard let ride = result["ride"] as? [String: Any] else {
            throw ProviderConfigurationError(message: "Réponse ride invalide.")
        }
        return mapRide(ride)
    }

    func getActiveRide() async throws -> LiveRideSnapshot? {
        let result = try await callFunction("getActiveRide", data: [:])
        guard let ride = result["ride"] as? [String: Any] else { return nil }
        return mapRide(ride)
    }

    func writeNativeLocationFallback(rideSessionId: String) async throws {
        _ = rideSessionId
        throw ProviderConfigurationError(message: "Capture GPS native requise avant l'envoi du batch.")
    }

    private func documents(for query: Query) async throws -> QuerySnapshot {
        try await withCheckedThrowingContinuation { continuation in
            query.getDocuments { snapshot, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let snapshot {
                    continuation.resume(returning: snapshot)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse Firestore invalide."))
                }
            }
        }
    }

    private func callFunction(_ name: String, data: [String: Any]) async throws -> [String: Any] {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable(name).call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any] {
                    continuation.resume(returning: payload)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse Cloud Functions invalide."))
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
