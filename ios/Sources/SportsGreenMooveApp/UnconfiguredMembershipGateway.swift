import Foundation

extension UnconfiguredFirebaseGateway {
    func membershipClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipClub> { throw membershipUnavailable }
    func requestMembership(uid: String, clubId: String) async throws -> MembershipReceipt { throw membershipUnavailable }
    func membershipReviewClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipChoice> { throw membershipUnavailable }
    func membershipReviews(uid: String, clubId: String, cursor: String?) async throws -> MembershipPage<MembershipReview> { throw membershipUnavailable }
    func decideMembership(uid: String, row: MembershipReview, decision: MembershipDecision) async throws -> MembershipDecisionReceipt { throw membershipUnavailable }
    private var membershipUnavailable: ProviderConfigurationError { .init(message: "Les adhésions ne sont pas configurées.") }
}
