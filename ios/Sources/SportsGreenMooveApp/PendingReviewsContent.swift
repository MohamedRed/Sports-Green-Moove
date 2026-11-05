import SwiftUI

struct PendingReviewsContent: View {
    let state: PendingReviewsState
    let submittingId: String?
    let busy: Bool
    let onMore: () -> Void
    let onRate: (InboxReviewPrompt, Int) -> Void

    var body: some View {
        Group {
            if state.items.isEmpty && state.nextCursor == nil { MessageEmptyCard(message: "Aucun avis en attente.") }
            ForEach(state.items) { review in
                ReviewCard(review: review, submitting: submittingId == review.id) { onRate(review, $0) }.disabled(busy)
            }
            if let error = state.error { MessageEmptyCard(message: error) }
            if state.nextCursor != nil {
                Button(state.loading ? "Chargement..." : state.items.isEmpty ? "Continuer la recherche" : "Voir d’autres avis") {
                    onMore()
                }
                .disabled(busy)
                .sgmUITestIdentifier("messages.reviews.more")
            }
        }
    }
}
