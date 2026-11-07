package be.sportgreenmoove.app.data

data class PendingReviewPage(val userId: String, val items: List<InboxReviewPrompt>, val nextCursor: String?)
