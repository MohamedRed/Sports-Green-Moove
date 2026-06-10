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
    case greenList
    case publish
    case search
    case notifications
    case co2
    case rewards
    case options

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Accueil"
        case .greenList: "Green-List"
        case .publish: "Publier"
        case .search: "Recherche"
        case .notifications: "Notifs"
        case .co2: "CO2"
        case .rewards: "Rewards"
        case .options: "Options"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .greenList: "calendar"
        case .publish: "plus.square"
        case .search: "magnifyingglass"
        case .notifications: "bell"
        case .co2: "leaf"
        case .rewards: "eurosign.circle"
        case .options: "gearshape"
        }
    }
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
