import Foundation

struct ClubSummary: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let sport: String
    let memberCount: Int
    let roleLabel: String?
    let initials: String
    let memberInitials: [String]
    var membershipStatus: String? = nil
    var membershipActive: Bool? = nil

    var isMember: Bool { (membershipStatus == "active" && membershipActive != false) || (membershipStatus == nil && membershipActive == true) }
}
