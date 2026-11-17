package be.sportgreenmoove.app.data

import java.util.UUID

data class TripChangeTerms(
    val departureAt: String, val arrivalBy: String?, val origin: MapPoint,
    val destination: MapPoint, val priceCents: Int,
)

data class TripChangePreview(
    val tripId: String, val revision: String, val terms: TripChangeTerms,
    val bookingCount: Int, val parentCount: Int,
)

enum class TripChangeStatus(val wire: String) {
    Pending("pending"), Confirmed("confirmed"), Declined("declined"), Withdrawn("withdrawn"),
    Cancelled("cancelled"), Applied("applied"), Outdated("outdated"),
}

enum class TripChangeDecision(val wire: String) { Accept("accept"), Decline("decline") }

data class TripChangeBalance(val bookingId: String, val balanceCents: Int)

data class TripChangeReview(
    val tripId: String, val proposalId: String, val revision: String, val status: TripChangeStatus,
    val originalTerms: TripChangeTerms, val terms: TripChangeTerms, val currentTerms: TripChangeTerms,
    val parentCount: Int, val acceptedParentCount: Int, val decision: TripChangeDecision?,
    val bookingIds: List<String>, val canRespond: Boolean, val canWithdraw: Boolean,
    val applied: Boolean, val balances: List<TripChangeBalance>, val createdAt: String,
    val sourceRevision: String, val proposalRequestId: String?, val decisionRequestId: String?, val withdrawalRequestId: String?,
)

data class TripChangeProposalRequest(
    val tripId: String, val expectedRevision: String, val terms: TripChangeTerms,
    val requestId: String = UUID.randomUUID().toString(),
)

data class TripChangeDecisionRequest(
    val tripId: String, val proposalId: String, val proposalRevision: String,
    val decision: TripChangeDecision, val requestId: String = UUID.randomUUID().toString(),
)

data class TripChangeWithdrawalRequest(
    val tripId: String, val proposalId: String, val requestId: String = UUID.randomUUID().toString(),
)

data class TripChangeQuoteRequest(
    val tripId: String, val proposalId: String, val proposalRevision: String,
    val requestId: String = UUID.randomUUID().toString(),
)

data class TripChangeRouteQuote(
    val quoteId: String, val distanceMeters: Int, val durationSeconds: Int,
    val encodedPolyline: String?, val expiresAt: String,
)

data class TripChangeApplyRequest(
    val tripId: String, val proposalId: String, val proposalRevision: String, val quoteId: String,
    val requestId: String = UUID.randomUUID().toString(),
)

data class TripChangeApplicationReceipt(
    val tripId: String, val proposalId: String, val proposalRevision: String, val quoteId: String,
    val requestId: String, val actorUserId: String, val appliedAt: String,
    val bookingIds: List<String>, val settlementRequiredCount: Int,
)
