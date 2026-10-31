import Foundation
import Observation

struct PendingReviewPage: Hashable, Sendable {
    let userId: String
    let items: [InboxReviewPrompt]
    let nextCursor: String?
}

protocol PendingReviewGateway: Sendable {
    func loadPendingReviews(cursor: String) async throws -> PendingReviewPage
}
extension PendingReviewGateway {
    func loadPendingReviews(cursor: String) async throws -> PendingReviewPage {
        throw ProviderConfigurationError(message: "Les avis ne sont pas configurés.")
    }
}

@Observable @MainActor final class PendingReviewsState {
    private(set) var items: [InboxReviewPrompt] = []
    private(set) var nextCursor: String?
    private(set) var loading = false
    private(set) var error: String?
    private var uid: String?
    private var generation = 0
    private var submittedIds: Set<String> = []

    func replace(_ inbox: InboxSummary) {
        generation += 1; loading = false
        if uid != inbox.reviewsUserId { submittedIds = [] }
        uid = inbox.reviewsUserId
        items = inbox.reviews.filter { !submittedIds.contains($0.id) }
        nextCursor = inbox.reviewsNextCursor; error = nil
    }
    func submitted(_ id: String) { submittedIds.insert(id); items.removeAll { $0.id == id } }
    func close() { generation += 1; items = []; nextCursor = nil; error = nil; submittedIds = []; uid = nil; loading = false }
    func more(_ gateway: any PendingReviewGateway) async {
        guard !loading, let cursor = nextCursor, let uid else { return }
        let ticket = generation
        loading = true; error = nil
        defer { if ticket == generation { loading = false } }
        do {
            let page = try await gateway.loadPendingReviews(cursor: cursor)
            try Task.checkCancellation()
            guard ticket == generation else { return }
            guard page.userId == uid, page.nextCursor != cursor else {
                throw ProviderConfigurationError(message: "Réponse avis invalide.")
            }
            var seen = Set(items.map(\.id)).union(submittedIds)
            items += page.items.filter { seen.insert($0.id).inserted }
            nextCursor = page.nextCursor
        } catch is CancellationError { }
        catch { if ticket == generation { self.error = "Impossible de charger les avis. Réessayez." } }
    }
}
