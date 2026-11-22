import Foundation
import Observation

protocol MessagesGateway: PendingReviewGateway {
    func getInbox(uid: String) async throws -> InboxSummary
    func submitRating(uid: String, rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String
}

@MainActor @Observable final class MessagesInboxState {
    private(set) var inbox = InboxSummary()
    let reviews = PendingReviewsState()
    private(set) var loading = false
    private(set) var submittingReviewId: String?
    private(set) var error: String?
    private(set) var notice: String?
    private let access: AccountAccess
    private let gateway: any MessagesGateway
    private var generation = UUID()
    private var active = true
    private var closed = false
    private var requiresRefresh = false
    private var inFlight = 0
    var live: Bool { !closed && active && access.isCurrent }
    var busy: Bool { inFlight > 0 || loading || submittingReviewId != nil || reviews.loading || access.waitingForEarlierWork }
    var canSubmit: Bool { live && !busy && !requiresRefresh }

    init(access: AccountAccess, gateway: any MessagesGateway) { self.access = access; self.gateway = gateway }
    private func clear() {
        generation = UUID(); inbox = InboxSummary(); reviews.close()
        loading = false; submittingReviewId = nil; error = nil; notice = nil
        requiresRefresh = false
    }
    func suspend() { active = false; clear() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; active = true; await refresh() }
    private func retain(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }
        return false
    }
    func refresh() async {
        guard live, !busy, let work = access.begin() else { return }
        generation = UUID(); let ticket = generation
        inFlight += 1
        inbox = InboxSummary(); reviews.prepareRefresh(); loading = true; error = nil; notice = nil
        defer { inFlight -= 1; access.finish(work); if generation == ticket { loading = false } }
        do {
            let next = try await gateway.getInbox(uid: access.context.uid)
            guard retain(ticket, work) else { return }
            guard next.reviewsUserId == access.context.uid else { throw CancellationError() }
            inbox = next; reviews.replace(next); requiresRefresh = false
        } catch {
            guard retain(ticket, work) else { return }
            self.error = "Impossible de charger vos messages. Actualisez pour réessayer."
        }
    }
    func more() async {
        guard canSubmit else { return }
        inFlight += 1
        defer { inFlight -= 1 }
        await reviews.more(gateway, access: access)
        if !live { clear() }
    }
    func submit(_ review: InboxReviewPrompt, score: Int) async {
        guard canSubmit, (1...5).contains(score), reviews.items.contains(review),
              review.ratedUserId != access.context.uid, let work = access.begin() else { return }
        let ticket = generation; submittingReviewId = review.id; error = nil; notice = nil
        inFlight += 1
        defer { inFlight -= 1; access.finish(work); if generation == ticket { submittingReviewId = nil } }
        do {
            let id = try await gateway.submitRating(uid: access.context.uid, rideSessionId: review.rideSessionId,
                ratedUserId: review.ratedUserId, score: score, comment: nil)
            guard retain(ticket, work) else { return }
            guard id == "\(review.rideSessionId)_\(access.context.uid)_\(review.ratedUserId)" else {
                throw ProviderConfigurationError(message: "Réponse avis invalide.")
            }
            reviews.submitted(review.id); notice = "Avis envoyé."
        } catch {
            guard retain(ticket, work) else { return }
            requiresRefresh = true
            self.error = "Envoi non confirmé. Actualisez les avis avant de réessayer."
        }
    }
}
