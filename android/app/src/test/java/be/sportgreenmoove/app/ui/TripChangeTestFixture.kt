package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TripChangeGateway
import be.sportgreenmoove.app.services.TripChangeDraftStorage
import java.time.Instant

internal object ChangeFixture {
    val now = Instant.parse("2026-10-17T12:00:00Z")
    val terms = TripChangeTerms("2026-12-01T10:00:00.123Z", "2026-12-01T11:00:00Z", MapPoint(50.71, 4.61), MapPoint(50.85, 4.35), 250)
    val preview = TripChangePreview("trip", "a".repeat(64), terms, 3, 2)
    val review = TripChangeReview("trip", "b".repeat(64), "c".repeat(64), TripChangeStatus.Pending,
        terms, terms.copy(priceCents = 400), terms, 2, 0, null, listOf("booking"), true, false, false,
        emptyList(), "2026-10-17T12:00:00Z", preview.revision, null, null, null)
    val confirmed = review.copy(status = TripChangeStatus.Confirmed, acceptedParentCount = 2, canRespond = false, canWithdraw = true)
    val quote = TripChangeRouteQuote("d".repeat(64), 15000, 1800, null, "2026-10-17T12:05:00Z")
    fun receipt(request: TripChangeApplyRequest) = TripChangeApplicationReceipt(request.tripId, request.proposalId,
        request.proposalRevision, request.quoteId, request.requestId, "driver", now.toString(), listOf("booking"), 1)
    fun state(gateway: TripChangeGateway, role: AppRole = AppRole.Driver, now: () -> Instant = { this.now }) =
        TripChangeState("trip", if (role == AppRole.Driver) "driver" else "parent", role, gateway, TestTripDraftStorage(), now)
}

internal class TestTripDraftStorage : TripChangeDraftStorage {
    val records = mutableMapOf<Pair<String, String>, TripChangeDraftRecord>()
    var failRead = false
    var failWrite = false
    override fun read(uid: String, tripId: String): TripChangeDraftRecord? { check(!failRead); return records[uid to tripId] }
    override fun write(uid: String, tripId: String, record: TripChangeDraftRecord?) {
        check(!failWrite)
        if (record == null) records.remove(uid to tripId) else records[uid to tripId] = record
    }
}

internal class ChangeGateway : TripChangeGateway {
    override suspend fun tripChangeHistory(tripId: String, cursor: String?): TripChangeHistoryPage = error("Unexpected history call")
    val proposals = mutableListOf<TripChangeProposalRequest>()
    val decisions = mutableListOf<TripChangeDecisionRequest>()
    val withdrawals = mutableListOf<TripChangeWithdrawalRequest>()
    val quotes = mutableListOf<TripChangeQuoteRequest>()
    val applications = mutableListOf<TripChangeApplyRequest>()
    var preview: suspend () -> TripChangePreview = { ChangeFixture.preview }
    var resolve: suspend (TripChangeProposalRequest) -> TripChangeReview? = { null }
    var review: suspend () -> TripChangeReview = { ChangeFixture.review }
    var propose: suspend (TripChangeProposalRequest) -> TripChangeReview = {
        ChangeFixture.review.copy(terms = it.terms, sourceRevision = it.expectedRevision, proposalRequestId = it.requestId, canRespond = false, canWithdraw = true)
    }
    var decide: suspend (TripChangeDecisionRequest) -> TripChangeReview = {
        ChangeFixture.review.copy(decision = it.decision, decisionRequestId = it.requestId, canRespond = false,
            status = if (it.decision == TripChangeDecision.Decline) TripChangeStatus.Declined else TripChangeStatus.Pending,
            acceptedParentCount = if (it.decision == TripChangeDecision.Accept) 1 else 0)
    }
    var withdraw: suspend (TripChangeWithdrawalRequest) -> TripChangeReview = {
        ChangeFixture.review.copy(status = TripChangeStatus.Withdrawn, canRespond = false, withdrawalRequestId = it.requestId)
    }
    var quote: suspend (TripChangeQuoteRequest) -> TripChangeRouteQuote = { ChangeFixture.quote }
    var apply: suspend (TripChangeApplyRequest) -> TripChangeApplicationReceipt = { ChangeFixture.receipt(it) }
    override suspend fun previewTripChange(tripId: String) = preview()
    override suspend fun resolveTripChangeProposal(request: TripChangeProposalRequest) = resolve(request)
    override suspend fun reviewTripChange(tripId: String, proposalId: String) = review()
    override suspend fun proposeTripChange(request: TripChangeProposalRequest): TripChangeReview { proposals += request; return propose(request) }
    override suspend fun respondTripChange(request: TripChangeDecisionRequest): TripChangeReview { decisions += request; return decide(request) }
    override suspend fun withdrawTripChange(request: TripChangeWithdrawalRequest): TripChangeReview { withdrawals += request; return withdraw(request) }
    override suspend fun quoteTripChange(request: TripChangeQuoteRequest): TripChangeRouteQuote { quotes += request; return quote(request) }
    override suspend fun applyTripChange(request: TripChangeApplyRequest): TripChangeApplicationReceipt { applications += request; return apply(request) }
}
