import Foundation

enum AppRole: String, CaseIterable, Identifiable, Codable, Sendable {
    case parent
    case driver
    case child
    case clubManager
    case admin

    var id: String { rawValue }
}

struct AuthSession: Hashable, Sendable {
    let uid: String
    let email: String?
}

enum AppTab: String, CaseIterable, Identifiable, Sendable {
    case home
    case trips
    case publish
    case messages
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Accueil"
        case .trips: "Trajets"
        case .publish: "Publier"
        case .messages: "Messages"
        case .profile: "Profil"
        }
    }
}

enum AppOverlay: String, Identifiable, Sendable {
    case search
    case groups
    case impact
    case rewards
    case options
    case ride

    var id: String { rawValue }
}

enum TripStatus: String, Hashable, Sendable {
    case upcoming
    case past
    case pending
}

struct TripSummary: Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let club: String
    let category: String
    let sport: String
    let departureLabel: String
    let dateLabel: String
    let timeLabel: String
    let distanceLabel: String
    let seatsAvailable: Int
    let seatsLabel: String
    let priceLabel: String
    let passengerInitials: [String]
    let reasons: [String]
    let status: TripStatus

    init(
        id: String,
        title: String,
        club: String,
        category: String,
        sport: String = "Football",
        departureLabel: String,
        dateLabel: String = "MAR 07 NOV",
        timeLabel: String = "16h45",
        distanceLabel: String = "5.2 km",
        seatsAvailable: Int,
        seatsLabel: String? = nil,
        priceLabel: String,
        passengerInitials: [String] = [],
        reasons: [String],
        status: TripStatus = .upcoming
    ) {
        self.id = id
        self.title = title
        self.club = club
        self.category = category
        self.sport = sport
        self.departureLabel = departureLabel
        self.dateLabel = dateLabel
        self.timeLabel = timeLabel
        self.distanceLabel = distanceLabel
        self.seatsAvailable = seatsAvailable
        self.seatsLabel = seatsLabel ?? "\(seatsAvailable) \(seatsAvailable > 1 ? "places" : "place")"
        self.priceLabel = priceLabel
        self.passengerInitials = passengerInitials
        self.reasons = reasons
        self.status = status
    }
}

struct LiveRideSnapshot: Hashable, Sendable {
    let rideSessionId: String
    let status: String
    let vehicleLastUpdateLabel: String
    let childLastUpdateLabel: String?
    let etaLabel: String
    let stale: Bool
}
