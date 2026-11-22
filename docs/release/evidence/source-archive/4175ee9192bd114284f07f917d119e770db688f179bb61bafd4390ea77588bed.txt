import Foundation

struct ClubMembership: Equatable, Sendable {
    let role: String
    let status: String?
    let active: Bool?
    var isActive: Bool { (status == "active" && active != false) || (status == nil && active == true) }
    var canRequest: Bool { status.map { ["rejected", "cancelled", "inactive"].contains($0) } ?? false }
    var label: String {
        switch status {
        case "requested": "En attente"
        case "active": isActive ? "Membre" : "Inactif"
        case "rejected": "Refusée"
        case "cancelled": "Annulée"
        case "inactive": "Inactive"
        case "blocked": "Bloquée"
        default: isActive ? "Membre" : "À vérifier"
        }
    }
}
struct MembershipClub: Identifiable, Equatable, Sendable {
    let id: String
    let name: String?
    let sport: String?
    let count: Int64?
    let status: String?
    var membership: ClubMembership?
    var requestable: Bool {
        name != nil && MembershipWire.requestableId(id) && status != "private" && status != "archived" &&
        (membership == nil || membership?.canRequest == true)
    }
}
struct MembershipChoice: Identifiable, Equatable, Sendable { let id: String; let name: String }
struct MembershipReview: Identifiable, Equatable, Sendable {
    let id: String
    let userId: String
    let name: String?
    let role: String
    let status: String
    let active: Bool
    let team: String?
    let version: String
    let actions: [MembershipDecision]
    var canDecide: Bool { name != nil && actions == [.approve, .reject] && role == "member" && status == "requested" && !active }
}
enum MembershipDecision: String, Sendable { case approve, reject }
struct MembershipPage<Row: Sendable>: Sendable { let userId: String; let items: [Row]; let cursor: String? }
struct MembershipReceipt: Sendable { let id: String; let status: String; let reused: Bool }
struct MembershipDecisionReceipt: Sendable { let id: String; let status: String; let reviewId: String }
enum MembershipError: Error { case invalidResponse }
protocol MembershipGateway: Sendable {
    func membershipClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipClub>
    func requestMembership(uid: String, clubId: String) async throws -> MembershipReceipt
    func membershipReviewClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipChoice>
    func membershipReviews(uid: String, clubId: String, cursor: String?) async throws -> MembershipPage<MembershipReview>
    func decideMembership(uid: String, row: MembershipReview, decision: MembershipDecision) async throws -> MembershipDecisionReceipt
}
