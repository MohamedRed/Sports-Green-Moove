import Foundation

func membershipClub(_ id: String = "club", status: String? = nil) -> MembershipClub {
    .init(id: id, name: "Synthetic club", sport: "Sport", count: 1, status: "public",
        membership: status.map { .init(role: "member", status: $0, active: $0 == "active") })
}
func membershipRow(version: String = "1700000000.1", status: String = "requested") -> MembershipReview {
    .init(id: "applicant_club", userId: "applicant", name: "Synthetic applicant", role: "member", status: status,
        active: status == "active", team: nil, version: version, actions: status == "requested" ? [.approve, .reject] : [])
}
actor MembershipProbe: MembershipGateway {
    private var continuation: CheckedContinuation<Void, Error>?
    private var arrival: CheckedContinuation<Void, Never>?
    private var expected = 0
    private var watchdog: Task<Void, Never>?
    private var suspended = false
    private var next: String?
    private var catalog: [MembershipClub] = [membershipClub()]
    private var rows: [MembershipReview] = [membershipRow()]
    private var choices: [MembershipChoice] = [.init(id: "club", name: "Synthetic club")]
    private var malformed = false
    private(set) var calls: [String] = []
    func configure(cursor: String? = nil, clubs: [MembershipClub]? = nil, rows: [MembershipReview]? = nil,
        choices: [MembershipChoice]? = nil, suspended: Bool = false, malformed: Bool = false) {
        next = cursor; if let clubs { catalog = clubs }; if let rows { self.rows = rows }; if let choices { self.choices = choices }
        self.suspended = suspended; self.malformed = malformed
    }
    func waitForCall(_ count: Int) async {
        if calls.count >= count { return }; expected = count
        await withCheckedContinuation { continuation in
            arrival = continuation
            watchdog = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(10)) } catch { return }; await self?.requireArrival()
            }
        }
    }
    private func requireArrival() { precondition(arrival == nil, "Expected controlled membership call never started") }
    private func gate(_ name: String, uid: String) async throws {
        check(uid == "parent", "Membership request adopted another account")
        calls.append(name)
        if calls.count >= expected { watchdog?.cancel(); arrival?.resume(); arrival = nil }
        if suspended { suspended = false; try await withCheckedThrowingContinuation { continuation = $0 } }
    }
    func release(failing: Bool) {
        if failing { continuation?.resume(throwing: MembershipError.invalidResponse) } else { continuation?.resume() }; continuation = nil
    }
    func membershipClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipClub> {
        let result = MembershipPage(userId: malformed ? "foreign" : uid, items: catalog, cursor: next)
        try await gate(cursor == nil ? "catalog" : "catalog-more", uid: uid); return result
    }
    func requestMembership(uid: String, clubId: String) async throws -> MembershipReceipt {
        let result = MembershipReceipt(id: malformed ? "foreign_club" : uid + "_" + clubId, status: "requested", reused: false)
        catalog = [membershipClub(clubId, status: "requested")]
        try await gate("request", uid: uid); return result
    }
    func membershipReviewClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipChoice> {
        let result = MembershipPage(userId: malformed ? "foreign" : uid, items: choices, cursor: next)
        try await gate(cursor == nil ? "choices" : "choices-more", uid: uid); return result
    }
    func membershipReviews(uid: String, clubId: String, cursor: String?) async throws -> MembershipPage<MembershipReview> {
        check(clubId == "club", "Review adopted another club")
        let result = MembershipPage(userId: malformed ? "foreign" : uid, items: rows, cursor: next)
        try await gate(cursor == nil ? "reviews" : "reviews-more", uid: uid); return result
    }
    func decideMembership(uid: String, row: MembershipReview, decision: MembershipDecision) async throws -> MembershipDecisionReceipt {
        let status = decision == .approve ? "active" : "rejected"
        let result = MembershipDecisionReceipt(id: malformed ? "foreign_club" : row.id, status: status, reviewId: "review")
        rows = [membershipRow(version: "1700000000.2", status: status)]
        try await gate("decide", uid: uid); return result
    }
}
extension AppDataFixtureGateway {
    func membershipClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipClub> { try await UnconfiguredFirebaseGateway().membershipClubs(uid: uid, cursor: cursor) }
    func requestMembership(uid: String, clubId: String) async throws -> MembershipReceipt { try await UnconfiguredFirebaseGateway().requestMembership(uid: uid, clubId: clubId) }
    func membershipReviewClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipChoice> { try await UnconfiguredFirebaseGateway().membershipReviewClubs(uid: uid, cursor: cursor) }
    func membershipReviews(uid: String, clubId: String, cursor: String?) async throws -> MembershipPage<MembershipReview> { try await UnconfiguredFirebaseGateway().membershipReviews(uid: uid, clubId: clubId, cursor: cursor) }
    func decideMembership(uid: String, row: MembershipReview, decision: MembershipDecision) async throws -> MembershipDecisionReceipt { try await UnconfiguredFirebaseGateway().decideMembership(uid: uid, row: row, decision: decision) }
}
