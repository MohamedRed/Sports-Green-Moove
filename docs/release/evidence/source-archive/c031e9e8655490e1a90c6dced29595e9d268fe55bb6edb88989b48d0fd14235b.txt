import Foundation

#if DEBUG
private actor UITestMemberships: MembershipGateway {
    static let shared = UITestMemberships()
    private var requested = false
    private var decision: MembershipDecision?
    func membershipClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipClub> {
        guard uid == "ui-user" else { throw CancellationError() }
        return .init(userId: uid, items: [MembershipClub(id: "club-tennis", name: "Tennis Club Wavre", sport: "Tennis", count: 56,
            status: "public", membership: requested ? .init(role: "member", status: "requested", active: false) : nil)], cursor: nil)
    }
    func requestMembership(uid: String, clubId: String) async throws -> MembershipReceipt {
        guard uid == "ui-user", clubId == "club-tennis" else { throw MembershipError.invalidResponse }
        let reused = requested; requested = true; return .init(id: uid + "_" + clubId, status: "requested", reused: reused)
    }
    func membershipReviewClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipChoice> {
        guard uid == "ui-user" else { throw CancellationError() }
        return .init(userId: uid, items: [.init(id: "club-tennis", name: "Tennis Club Wavre")], cursor: nil)
    }
    func membershipReviews(uid: String, clubId: String, cursor: String?) async throws -> MembershipPage<MembershipReview> {
        guard uid == "ui-user", clubId == "club-tennis" else { throw MembershipError.invalidResponse }
        return .init(userId: uid, items: [.init(id: "ui-parent_club-tennis", userId: "ui-parent", name: "Parent Démo", role: "member",
            status: decision == .approve ? "active" : decision == .reject ? "rejected" : "requested", active: decision == .approve,
            team: nil, version: "1700000000.1", actions: decision == nil ? [.approve, .reject] : [])], cursor: nil)
    }
    func decideMembership(uid: String, row: MembershipReview, decision: MembershipDecision) async throws -> MembershipDecisionReceipt {
        guard uid == "ui-user", self.decision == nil, row.id == "ui-parent_club-tennis", row.version == "1700000000.1" else { throw MembershipError.invalidResponse }
        self.decision = decision; return .init(id: row.id, status: decision == .approve ? "active" : "rejected", reviewId: "ui-review")
    }
}
extension UITestFirebaseGateway {
    func membershipClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipClub> { try await UITestMemberships.shared.membershipClubs(uid: uid, cursor: cursor) }
    func requestMembership(uid: String, clubId: String) async throws -> MembershipReceipt { try await UITestMemberships.shared.requestMembership(uid: uid, clubId: clubId) }
    func membershipReviewClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipChoice> { try await UITestMemberships.shared.membershipReviewClubs(uid: uid, cursor: cursor) }
    func membershipReviews(uid: String, clubId: String, cursor: String?) async throws -> MembershipPage<MembershipReview> { try await UITestMemberships.shared.membershipReviews(uid: uid, clubId: clubId, cursor: cursor) }
    func decideMembership(uid: String, row: MembershipReview, decision: MembershipDecision) async throws -> MembershipDecisionReceipt { try await UITestMemberships.shared.decideMembership(uid: uid, row: row, decision: decision) }
}
#endif
