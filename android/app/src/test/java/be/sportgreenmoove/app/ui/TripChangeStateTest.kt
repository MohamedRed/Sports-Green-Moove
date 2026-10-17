package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TripChangeQuoteExpiredException
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.time.Instant

class TripChangeStateTest {
    @Test fun onlyExplicitValidChangedDriverTermsCanBeProposed() = runBlocking {
        val gateway = ChangeGateway(); val state = ChangeFixture.state(gateway)
        state.propose { fail() }; assertTrue(gateway.proposals.isEmpty())
        state.reload(null); assertFalse(state.canPropose)
        requireNotNull(state.draft).price = "4,00"; assertTrue(state.canPropose)
        state.propose {}; assertEquals(400, gateway.proposals.single().terms.priceCents)
        assertFalse(state.applied || state.canEdit || state.canRespond)
        assertTrue(state.canWithdraw); state.propose { fail() }; assertEquals(1, gateway.proposals.size)
    }
    @Test fun uncertainProposalRequiresRefreshAndReusesExactRequest() = runBlocking {
        val gateway = ChangeGateway(); val succeed = gateway.propose
        gateway.propose = { throw IOException() }
        val state = ChangeFixture.state(gateway); state.reload(null); requireNotNull(state.draft).price = "4,00"
        state.propose {}; assertTrue(state.requiresReload); assertFalse(state.canPropose || state.canEdit)
        state.propose { fail() }; assertEquals(1, gateway.proposals.size)
        state.reload(null); gateway.propose = succeed; state.propose {}
        assertEquals(gateway.proposals[0], gateway.proposals[1])
    }
    @Test fun changedSourceRevisionRequiresFreshDraftAndRequest() = runBlocking {
        val gateway = ChangeGateway(); val succeed = gateway.propose; gateway.propose = { throw IOException() }
        val state = ChangeFixture.state(gateway); state.reload(null); requireNotNull(state.draft).price = "4,00"; state.propose {}
        gateway.preview = { ChangeFixture.preview.copy(revision = "e".repeat(64)) }
        state.reload(null); assertEquals("2,50", requireNotNull(state.draft).price); assertFalse(state.canPropose)
        requireNotNull(state.draft).price = "4,00"; gateway.propose = succeed; state.propose {}
        assertNotEquals(gateway.proposals[0].requestId, gateway.proposals[1].requestId)
    }
    @Test fun refreshFindsCommittedProposalEvenWhenBothAcknowledgementAndListRefreshWereLost() = runBlocking {
        val gateway = ChangeGateway(); val saved = gateway.propose
        var recorded: TripChangeReview? = null
        gateway.propose = { recorded = saved(it); throw IOException() }
        val state = ChangeFixture.state(gateway); state.reload(null); requireNotNull(state.draft).price = "4,00"
        state.propose { throw IOException() }; assertTrue(state.requiresReload)
        gateway.preview = { error("A persisted pending proposal has no new editor preview") }
        gateway.resolve = { recorded }
        state.reload(null)
        assertEquals(recorded, state.review); assertFalse(state.requiresReload || state.canEdit)
        assertEquals(1, gateway.proposals.size); assertTrue(state.canWithdraw)
    }
    @Test fun failedResolutionNeverFallsThroughToAnotherPreviewOrWrite() = runBlocking {
        val gateway = ChangeGateway().apply { propose = { throw IOException() } }
        val state = ChangeFixture.state(gateway); state.reload(null); requireNotNull(state.draft).price = "4,00"; state.propose {}
        gateway.resolve = { throw IOException() }; gateway.preview = { fail("No alternate read after unknown resolution"); ChangeFixture.preview }
        state.reload(null)
        assertTrue(state.requiresReload); assertEquals(1, gateway.proposals.size); assertNull(state.review)
    }
    @Test fun eachParentDecisionIsExplicitAndDoesNotApplyTheChange() = runBlocking {
        for (decision in TripChangeDecision.entries) {
            val gateway = ChangeGateway(); val state = ChangeFixture.state(gateway, AppRole.Parent)
            state.reload(ChangeFixture.review.proposalId); assertTrue(state.canRespond)
            assertTrue(gateway.decisions.isEmpty()); state.decide(decision) {}
            assertEquals(decision, state.review?.decision); assertFalse(state.applied || state.canRespond || state.canApply)
            assertEquals(ChangeFixture.terms, state.review?.currentTerms)
            state.decide(decision) { fail() }; assertEquals(1, gateway.decisions.size)
        }
    }
    @Test fun uncertainDecisionReusesIntentAndRecordedReviewDoesNotWriteAgain() = runBlocking {
        val gateway = ChangeGateway(); val succeed = gateway.decide; gateway.decide = { throw IOException() }
        val state = ChangeFixture.state(gateway, AppRole.Parent); state.reload(ChangeFixture.review.proposalId)
        state.decide(TripChangeDecision.Accept) {}; state.decide(TripChangeDecision.Accept) { fail() }
        state.reload(ChangeFixture.review.proposalId); gateway.decide = succeed; state.decide(TripChangeDecision.Accept) {}
        assertEquals(gateway.decisions[0], gateway.decisions[1])
        gateway.review = { requireNotNull(state.review) }; state.reload(ChangeFixture.review.proposalId)
        state.decide(TripChangeDecision.Accept) { fail() }; assertEquals(2, gateway.decisions.size)
    }
    @Test fun confirmationRequiresCurrentRouteAndExplicitApplication() = runBlocking {
        val gateway = ChangeGateway().apply { review = { ChangeFixture.confirmed } }
        val state = ChangeFixture.state(gateway); state.reload(ChangeFixture.review.proposalId)
        assertFalse(state.applied || state.canApply); assertTrue(state.canQuote)
        state.apply { fail() }; assertTrue(gateway.applications.isEmpty())
        state.calculateRoute(); assertTrue(state.canApply); assertTrue(gateway.applications.isEmpty())
        gateway.review = { ChangeFixture.confirmed.copy(status = TripChangeStatus.Applied, applied = true, canWithdraw = false) }
        state.apply {}; assertTrue(state.applied); assertFalse(state.canApply || state.canQuote)
        state.apply { fail() }; assertEquals(1, gateway.applications.size)
    }
    @Test fun provenReceiptSurvivesRefreshFailureAndPreventsDuplicateApplication() = runBlocking {
        val gateway = ChangeGateway().apply { review = { ChangeFixture.confirmed } }
        val state = ChangeFixture.state(gateway); state.reload(ChangeFixture.review.proposalId); state.calculateRoute()
        state.apply { throw IOException() }
        assertTrue(state.applied && state.requiresReload); assertNotNull(state.application)
        state.apply { fail() }; assertEquals(1, gateway.applications.size)
    }
    @Test fun uncertainApplyKeepsExactRequestAndQuoteAfterExplicitRefresh() = runBlocking {
        val gateway = ChangeGateway().apply { review = { ChangeFixture.confirmed } }; val succeed = gateway.apply
        gateway.apply = { throw IOException() }
        val state = ChangeFixture.state(gateway); state.reload(ChangeFixture.review.proposalId); state.calculateRoute(); state.apply {}
        assertFalse(state.applied || state.canApply); state.reload(ChangeFixture.review.proposalId)
        gateway.apply = succeed; state.apply {}
        assertEquals(gateway.applications[0], gateway.applications[1]); assertTrue(state.applied)
    }
    @Test fun wrongActorReceiptCannotClaimApplication() = runBlocking {
        val gateway = ChangeGateway().apply {
            review = { ChangeFixture.confirmed }; apply = { ChangeFixture.receipt(it).copy(actorUserId = "other") }
        }
        val state = ChangeFixture.state(gateway); state.reload(ChangeFixture.review.proposalId); state.calculateRoute(); state.apply {}
        assertFalse(state.applied); assertTrue(state.requiresReload)
    }
    @Test fun expiryRequiresANewExplicitCalculationWithANewIdentity() = runBlocking {
        var now = ChangeFixture.now
        val gateway = ChangeGateway().apply { review = { ChangeFixture.confirmed } }
        val state = ChangeFixture.state(gateway, now = { now }); state.reload(ChangeFixture.review.proposalId); state.calculateRoute()
        now = Instant.parse(ChangeFixture.quote.expiresAt); assertFalse(state.canApply)
        state.expireQuote(ChangeFixture.quote.quoteId); assertNull(state.quote); assertTrue(state.canQuote)
        gateway.quote = { ChangeFixture.quote.copy(expiresAt = now.plusSeconds(300).toString()) }; state.calculateRoute()
        assertNotEquals(gateway.quotes[0].requestId, gateway.quotes[1].requestId)
    }
    @Test fun unknownQuoteResponseIsRetriedWithSameIdentityUnlessServerConfirmsExpiry() = runBlocking {
        val gateway = ChangeGateway().apply { review = { ChangeFixture.confirmed }; quote = { throw IOException() } }
        val state = ChangeFixture.state(gateway); state.reload(ChangeFixture.review.proposalId); state.calculateRoute()
        state.reload(ChangeFixture.review.proposalId); gateway.quote = { throw TripChangeQuoteExpiredException() }; state.calculateRoute()
        assertEquals(gateway.quotes[0], gateway.quotes[1]); assertTrue(state.requiresReload)
        state.reload(ChangeFixture.review.proposalId); gateway.quote = { ChangeFixture.quote }; state.calculateRoute()
        assertNotEquals(gateway.quotes[1].requestId, gateway.quotes[2].requestId)
    }
    @Test fun outdatedReviewDisablesDecisionAndApplication() = runBlocking {
        val gateway = ChangeGateway().apply { review = { ChangeFixture.review.copy(status = TripChangeStatus.Outdated, canRespond = false) } }
        val state = ChangeFixture.state(gateway, AppRole.Parent); state.reload(ChangeFixture.review.proposalId)
        state.decide(TripChangeDecision.Accept) { fail() }; state.apply { fail() }; state.calculateRoute()
        assertTrue(gateway.decisions.isEmpty() && gateway.applications.isEmpty() && gateway.quotes.isEmpty())
    }
    @Test fun closingDropsPrivateDataAndIgnoresLateWrite() = runBlocking {
        val gateway = ChangeGateway(); val response = CompletableDeferred<TripChangeReview>()
        gateway.decide = { withContext(NonCancellable) { response.await() } }
        val state = ChangeFixture.state(gateway, AppRole.Parent); state.reload(ChangeFixture.review.proposalId)
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.decide(TripChangeDecision.Accept) { fail() } }
        state.close(); response.complete(ChangeFixture.review); job.join()
        assertNull(state.review); assertNull(state.error); assertFalse(state.busy || state.canRespond)
    }
    @Test fun closingIgnoresLatePreviewAndCannotRestoreADraft() = runBlocking {
        val gateway = ChangeGateway(); val response = CompletableDeferred<TripChangePreview>()
        gateway.preview = { withContext(NonCancellable) { response.await() } }
        val state = ChangeFixture.state(gateway)
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.reload(null) }
        state.close(); response.complete(ChangeFixture.preview); job.join()
        assertNull(state.preview); assertNull(state.draft); assertNull(state.error); assertFalse(state.canEdit || state.busy)
    }
    @Test fun foreignReviewCannotReplaceTheCurrentTripOrUnlockActions() = runBlocking {
        val gateway = ChangeGateway().apply { review = { ChangeFixture.review.copy(tripId = "foreign") } }
        val state = ChangeFixture.state(gateway, AppRole.Parent); state.reload(ChangeFixture.review.proposalId)
        assertNull(state.review); assertTrue(state.requiresReload); assertFalse(state.canRespond)
        state.decide(TripChangeDecision.Accept) { fail() }; assertTrue(gateway.decisions.isEmpty())
    }
    @Test fun overlappingActionsCannotWriteTwiceAndWithdrawalPreservesOriginal() = runBlocking {
        val gateway = ChangeGateway().apply { review = { ChangeFixture.confirmed } }
        val response = CompletableDeferred<TripChangeReview>(); gateway.withdraw = { response.await() }
        val state = ChangeFixture.state(gateway); state.reload(ChangeFixture.review.proposalId)
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.withdraw {} }
        state.withdraw { fail() }; state.calculateRoute(); state.reload(null)
        assertEquals(1, gateway.withdrawals.size); assertTrue(gateway.quotes.isEmpty())
        response.complete(ChangeFixture.confirmed.copy(status = TripChangeStatus.Withdrawn, canWithdraw = false,
            withdrawalRequestId = gateway.withdrawals.single().requestId)); job.join()
        assertEquals(ChangeFixture.terms, state.review?.currentTerms); assertFalse(state.applied || state.canWithdraw)
    }
}
