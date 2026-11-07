package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import org.junit.Assert.*
import org.junit.Test

class TripChangeMappingTest {
    private val revision = "a".repeat(64)
    private val proposalId = "b".repeat(64)
    private val requestId = "11111111-1111-4111-8111-111111111111"
    private val terms = TripChangeTerms("2026-12-01T10:00:00Z", null, MapPoint(50.7, 4.6), MapPoint(50.8, 4.3), 250)
    private fun view(): Map<String, Any?> = mapOf("tripId" to "trip", "proposalId" to proposalId, "revision" to revision,
        "sourceRevision" to revision, "status" to "pending", "originalTerms" to TripChangeWire.termsPayload(terms),
        "terms" to TripChangeWire.termsPayload(terms.copy(priceCents = 400)), "currentTerms" to TripChangeWire.termsPayload(terms),
        "parentCount" to 2, "acceptedParentCount" to 0, "decision" to null, "bookingIds" to listOf("booking"),
        "canRespond" to true, "canWithdraw" to false, "applied" to false, "applicationImplemented" to true,
        "balances" to listOf(mapOf("bookingId" to "booking", "balanceCents" to 0)), "createdAt" to "2026-10-17T12:00:00Z",
        "proposalRequestId" to null, "decisionRequestId" to null, "withdrawalRequestId" to null)
    private fun rejected(block: () -> Unit) { try { block(); fail("Expected rejection") } catch (_: Exception) {} }

    @Test fun exactPayloadsBindAllWritesWithoutClientAuthority() {
        val propose = TripChangeProposalRequest("trip", revision, terms, requestId)
        assertEquals(setOf("tripId", "expectedRevision", "terms", "requestId"), propose.callablePayload().keys)
        assertEquals(requestId, propose.callablePayload()["requestId"])
        assertEquals("decline", TripChangeDecisionRequest("trip", proposalId, revision, TripChangeDecision.Decline, requestId).callablePayload()["decision"])
        assertEquals(proposalId, TripChangeApplyRequest("trip", proposalId, revision, proposalId, requestId).callablePayload()["quoteId"])
        for (bad in listOf("/foreign", "..", "__hidden__", "")) rejected { propose.copy(tripId = bad).callablePayload() }
        rejected { propose.copy(requestId = "retry").callablePayload() }; rejected { propose.copy(expectedRevision = "stale").callablePayload() }
    }
    @Test fun fullReviewIsStrictAndScopedToTheRequestedTripAndProposal() {
        val result = tripChangeReview(view(), "trip", proposalId)
        assertEquals(TripChangeStatus.Pending, result.status); assertTrue(result.canRespond); assertFalse(result.applied)
        rejected { tripChangeReview(view(), "foreign", proposalId) }; rejected { tripChangeReview(view(), "trip", revision) }
        for (key in listOf("decision", "sourceRevision", "proposalRequestId", "decisionRequestId", "withdrawalRequestId", "balances"))
            rejected { tripChangeReview(view() - key, "trip", proposalId) }
    }
    @Test fun invalidCountsStatesAndForeignBalancesAreRejected() {
        val cases = listOf(mapOf("acceptedParentCount" to 3), mapOf("parentCount" to 1.5), mapOf("status" to "unknown"),
            mapOf("status" to "confirmed"), mapOf("applied" to true), mapOf("decision" to "silent"),
            mapOf("canRespond" to "true"), mapOf("canWithdraw" to true), mapOf("bookingIds" to listOf("booking", "booking")),
            mapOf("balances" to listOf(mapOf("bookingId" to "foreign", "balanceCents" to 100))),
            mapOf("balances" to listOf(mapOf("bookingId" to "booking", "balanceCents" to Double.NaN))),
            mapOf("decisionRequestId" to "not-a-uuid"))
        cases.forEach { rejected { tripChangeReview(view() + it, "trip", proposalId) } }
    }
    @Test fun malformedTermsFailClosedWithoutCoercion() {
        for (amount in listOf(-1, 0.5, 100001, Double.NaN, Double.POSITIVE_INFINITY, "250"))
            rejected { TripChangeWire.terms(TripChangeWire.termsPayload(terms) + ("priceCents" to amount)) }
        rejected { TripChangeWire.terms(TripChangeWire.termsPayload(terms) - "arrivalBy") }
        rejected { TripChangeWire.terms(TripChangeWire.termsPayload(terms) + ("origin" to mapOf("lat" to 91, "lng" to 4))) }
        rejected { TripChangeWire.terms(TripChangeWire.termsPayload(terms) + ("arrivalBy" to "2026-12-01T09:00:00Z")) }
    }
    @Test fun receiptRequiresExactActorRequestRevisionAndQuote() {
        val request = TripChangeApplyRequest("trip", proposalId, revision, revision, requestId)
        val raw = request.callablePayload() + mapOf("status" to "applied", "actorUserId" to "driver", "appliedAt" to terms.departureAt,
            "bookingIds" to listOf("booking"), "settlementRequiredCount" to 1)
        assertEquals(1, tripChangeApplicationReceipt(raw, request, "driver").settlementRequiredCount)
        for ((key, value) in listOf("actorUserId" to "other", "requestId" to "22222222-2222-4222-8222-222222222222",
            "tripId" to "other", "proposalId" to revision, "proposalRevision" to proposalId, "quoteId" to proposalId,
            "status" to "confirmed", "settlementRequiredCount" to 2)) rejected { tripChangeApplicationReceipt(raw + (key to value), request, "driver") }
    }
    @Test fun quoteHasBoundedServerRouteAndExpiry() {
        val raw = mapOf("quoteId" to proposalId, "route" to mapOf("distanceMeters" to 15000, "durationSeconds" to 1800), "expiresAt" to terms.departureAt)
        assertEquals(15000, tripChangeRouteQuote(raw).distanceMeters)
        for (route in listOf(mapOf("distanceMeters" to 0, "durationSeconds" to 1), mapOf("distanceMeters" to 1, "durationSeconds" to 0.5),
            mapOf("distanceMeters" to Double.POSITIVE_INFINITY, "durationSeconds" to 1))) rejected { tripChangeRouteQuote(raw + ("route" to route)) }
        rejected { tripChangeRouteQuote(raw + ("expiresAt" to "tomorrow")) }
    }
    @Test fun readOnlyResolutionRequiresExactRequestAndExplicitAbsence() {
        val request = TripChangeProposalRequest("trip", revision, terms.copy(priceCents = 400), requestId)
        val absent = mapOf("tripId" to "trip", "requestId" to requestId, "recorded" to false, "review" to null)
        assertNull(tripChangeProposalResolution(absent, request))
        val recorded = absent + mapOf("recorded" to true, "review" to (view() + ("proposalRequestId" to requestId)))
        assertEquals(proposalId, tripChangeProposalResolution(recorded, request)?.proposalId)
        for (bad in listOf(absent - "review", absent + ("review" to view()), absent + ("recorded" to "false"),
            recorded + ("tripId" to "foreign"), recorded + ("requestId" to "22222222-2222-4222-8222-222222222222"),
            recorded + ("review" to view()))) rejected { tripChangeProposalResolution(bad, request) }
    }
}
