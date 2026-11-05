import Foundation

struct PendingReviewPage: Hashable, Sendable {
    let userId: String
    let items: [InboxReviewPrompt]
    let nextCursor: String?
}

protocol PendingReviewGateway: Sendable {
    func loadPendingReviews(uid: String, cursor: String) async throws -> PendingReviewPage
}
extension PendingReviewGateway {
    func loadPendingReviews(uid: String, cursor: String) async throws -> PendingReviewPage {
        throw ProviderConfigurationError(message: "Les avis ne sont pas configurés.")
    }
}
