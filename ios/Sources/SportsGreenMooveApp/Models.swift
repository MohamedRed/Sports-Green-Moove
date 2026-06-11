import Foundation

enum AppRole: String, CaseIterable, Identifiable, Codable {
    case parent
    case driver
    case child
    case clubManager
    case admin

    var id: String { rawValue }
}

enum AppTab: String, CaseIterable, Identifiable {
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

enum AppOverlay: String, Identifiable {
    case search
    case groups
    case impact
    case rewards
    case options
    case ride

    var id: String { rawValue }
}

struct TripSummary: Identifiable, Hashable {
    let id: String
    let title: String
    let club: String
    let category: String
    let departureLabel: String
    let seatsAvailable: Int
    let priceLabel: String
    let reasons: [String]
}

struct LiveRideSnapshot: Hashable {
    let rideSessionId: String
    let status: String
    let vehicleLastUpdateLabel: String
    let childLastUpdateLabel: String?
    let etaLabel: String
    let stale: Bool
}
