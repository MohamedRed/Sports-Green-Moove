import Foundation

public struct ActiveRidePermissionSnapshot: Equatable, Sendable {
    public let hasForegroundLocation: Bool
    public let hasBackgroundLocation: Bool
    public let hasNotifications: Bool

    public init(hasForegroundLocation: Bool, hasBackgroundLocation: Bool, hasNotifications: Bool) {
        self.hasForegroundLocation = hasForegroundLocation
        self.hasBackgroundLocation = hasBackgroundLocation
        self.hasNotifications = hasNotifications
    }
}

public enum ActiveRidePermissionRequirement: Equatable, Sendable {
    case foregroundLocation
    case backgroundLocation
    case notifications
}

public enum ActiveRidePermissionPolicy {
    public static func missingRequirements(_ snapshot: ActiveRidePermissionSnapshot) -> [ActiveRidePermissionRequirement] {
        var missing: [ActiveRidePermissionRequirement] = []
        if !snapshot.hasForegroundLocation { missing.append(.foregroundLocation) }
        if !snapshot.hasBackgroundLocation { missing.append(.backgroundLocation) }
        if !snapshot.hasNotifications { missing.append(.notifications) }
        return missing
    }

    public static func canStartActiveRide(_ snapshot: ActiveRidePermissionSnapshot) -> Bool {
        missingRequirements(snapshot).isEmpty
    }
}

public enum TripStatePolicy {
    public static func status(now: Date, departure: Date?) -> TripStatus {
        guard let departure, departure < now else { return .upcoming }
        return .past
    }
}

public struct NativeMatchCandidateSignal: Equatable, Sendable {
    public let detourSeconds: Int
    public let detourMeters: Int
    public let pickupMeters: Int
    public let scheduleDeltaMinutes: Int
    public let sameClub: Bool
    public let sameTeam: Bool
    public let seatsAvailable: Int
    public let seatsNeeded: Int
    public let supportsVehicleTracking: Bool
    public let supportsChildTracking: Bool
    public let driverRating: Double
    public let co2SavedKgEstimate: Double
    public let priceCents: Int
    public var maxDetourMinutes: Int?
    public var maxPickupDistanceMeters: Int?

    public init(
        detourSeconds: Int,
        detourMeters: Int,
        pickupMeters: Int,
        scheduleDeltaMinutes: Int,
        sameClub: Bool,
        sameTeam: Bool,
        seatsAvailable: Int,
        seatsNeeded: Int,
        supportsVehicleTracking: Bool,
        supportsChildTracking: Bool,
        driverRating: Double,
        co2SavedKgEstimate: Double,
        priceCents: Int,
        maxDetourMinutes: Int? = nil,
        maxPickupDistanceMeters: Int? = nil
    ) {
        self.detourSeconds = detourSeconds
        self.detourMeters = detourMeters
        self.pickupMeters = pickupMeters
        self.scheduleDeltaMinutes = scheduleDeltaMinutes
        self.sameClub = sameClub
        self.sameTeam = sameTeam
        self.seatsAvailable = seatsAvailable
        self.seatsNeeded = seatsNeeded
        self.supportsVehicleTracking = supportsVehicleTracking
        self.supportsChildTracking = supportsChildTracking
        self.driverRating = driverRating
        self.co2SavedKgEstimate = co2SavedKgEstimate
        self.priceCents = priceCents
        self.maxDetourMinutes = maxDetourMinutes
        self.maxPickupDistanceMeters = maxPickupDistanceMeters
    }
}

public enum NativeMatchingScore {
    public static func score(_ signal: NativeMatchCandidateSignal) -> Double {
        var score = 100.0
        let detourMinutes = Double(signal.detourSeconds) / 60
        score -= detourMinutes * 2.25
        score -= (Double(signal.detourMeters) / 1000) * 1.1
        score -= (Double(signal.pickupMeters) / 1000) * 5
        score -= Double(abs(signal.scheduleDeltaMinutes)) * 1.4

        if signal.sameClub { score += 14 }
        if signal.sameTeam { score += 18 }
        if signal.seatsAvailable > signal.seatsNeeded {
            score += Double(min(8, signal.seatsAvailable * 2))
        }
        if signal.supportsVehicleTracking { score += 6 }
        if signal.supportsChildTracking { score += 8 }

        score += max(0, signal.driverRating - 3) * 5
        score += min(8, signal.co2SavedKgEstimate)
        score -= min(10, Double(signal.priceCents) / 100)

        if let maxDetourMinutes = signal.maxDetourMinutes, detourMinutes > Double(maxDetourMinutes) {
            score -= 80
        }
        if let maxPickupDistanceMeters = signal.maxPickupDistanceMeters, signal.pickupMeters > maxPickupDistanceMeters {
            score -= 80
        }
        return (score * 100).rounded() / 100
    }
}

public struct NativeRewardLedgerEntry: Equatable, Sendable {
    public let userId: String
    public let amountCents: Int

    public init(userId: String, amountCents: Int) {
        self.userId = userId
        self.amountCents = amountCents
    }
}

public enum NativeImpactLedger {
    private static let gramsPerKmByCar = 171.0
    private static let sharedRideCreditRatio = 0.78

    public static func estimateCo2SavedKg(distanceMeters: Int, passengersSharing: Int) -> Double {
        guard distanceMeters > 0, passengersSharing > 0 else { return 0 }
        let avoidedSoloTrips = max(0, passengersSharing - 1)
        let grams = (Double(distanceMeters) / 1000) * gramsPerKmByCar * Double(avoidedSoloTrips) * sharedRideCreditRatio
        return ((grams / 1000) * 100).rounded() / 100
    }

    public static func rewardForCo2Saved(_ co2SavedKg: Double) -> Int {
        guard co2SavedKg > 0 else { return 0 }
        return Int((co2SavedKg * 12).rounded())
    }

    public static func rewardBalanceCents(entries: [NativeRewardLedgerEntry], userId: String) -> Int {
        entries.filter { $0.userId == userId }.reduce(0) { $0 + $1.amountCents }
    }
}

public struct NativeLocationBatchUpdate: Encodable, Equatable, Sendable {
    public let rideSessionId: String
    public let role: String
    public let latitude: Double
    public let longitude: Double
    public let accuracyM: Double
    public let capturedAtMs: Int
    public let speedMps: Double?
    public let headingDeg: Double?

    public init(
        rideSessionId: String,
        role: String,
        latitude: Double,
        longitude: Double,
        accuracyM: Double,
        capturedAtMs: Int,
        speedMps: Double? = nil,
        headingDeg: Double? = nil
    ) {
        self.rideSessionId = rideSessionId
        self.role = role
        self.latitude = latitude
        self.longitude = longitude
        self.accuracyM = max(accuracyM, 0)
        self.capturedAtMs = capturedAtMs
        self.speedMps = speedMps
        self.headingDeg = headingDeg
    }

    enum CodingKeys: String, CodingKey {
        case rideSessionId
        case role
        case latitude = "lat"
        case longitude = "lng"
        case accuracyM
        case capturedAtMs = "capturedAt"
        case speedMps
        case headingDeg
    }

    public func callableBatchJson() throws -> String {
        let data = try JSONEncoder().encode([self])
        guard let json = String(data: data, encoding: .utf8) else {
            throw ProviderConfigurationError(message: "Encodage JSON localisation invalide.")
        }
        return json
    }
}
