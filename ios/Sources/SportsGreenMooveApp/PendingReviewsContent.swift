import SwiftUI

struct PendingReviewsContent: View {
    let state: PendingReviewsState
    let submittingId: String?
    let gateway: any PendingReviewGateway
    let onRate: (InboxReviewPrompt, Int) -> Void

    var body: some View {
        Group {
            if state.items.isEmpty && state.nextCursor == nil { MessageEmptyCard(message: "Aucun avis en attente.") }
            ForEach(state.items) { review in
                ReviewCard(review: review, submitting: submittingId == review.id) { onRate(review, $0) }
            }
            if let error = state.error { MessageEmptyCard(message: error) }
            if state.nextCursor != nil {
                Button(state.loading ? "Chargement..." : state.items.isEmpty ? "Continuer la recherche" : "Voir d’autres avis") {
                    Task { await state.more(gateway) }
                }
                .disabled(state.loading)
                .sgmUITestIdentifier("messages.reviews.more")
            }
        }
    }
}
