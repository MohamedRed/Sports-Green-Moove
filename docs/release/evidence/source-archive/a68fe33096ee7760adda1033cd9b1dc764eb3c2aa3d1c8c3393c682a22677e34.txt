import Foundation

struct ClubSummary: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let sport: String
    let memberCount: Int
    let roleLabel: String?
    let initials: String
    let memberInitials: [String]

    var isMember: Bool { roleLabel != nil }
}
