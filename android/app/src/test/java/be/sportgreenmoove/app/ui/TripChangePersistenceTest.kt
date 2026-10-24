package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.time.LocalDate
import java.time.LocalTime

class TripChangePersistenceTest {
    private val storage = TestTripDraftStorage()
    private val gateway = ChangeGateway()
    private fun state(uid: String = "driver", trip: String = "trip", role: AppRole = AppRole.Driver) =
        TripChangeState(trip, uid, role, gateway, storage) { ChangeFixture.now }

    @Test fun rawInvalidFieldsSurviveNewStateWithoutWritesToTheTrip() = runBlocking {
        val first = state(); first.reload(null)
        requireNotNull(first.draft).apply {
            departureDate = LocalDate.of(2026, 12, 2); departureTime = LocalTime.of(15, 23)
            arrivalDate = LocalDate.of(2026, 12, 3); arrivalTime = LocalTime.of(17, 11); hasArrival = false
            price = "4,"; origin.edit("Rue pas encore choisie"); destination.edit("Une autre rue")
        }
        val snapshot = requireNotNull(first.draft).snapshot()
        first.close()
        val second = state(); second.reload(null)
        assertEquals(snapshot, requireNotNull(second.draft).snapshot())
        assertNull(second.draft?.origin?.point); assertTrue(second.draft?.origin?.suggestions.isNullOrEmpty())
        assertFalse(second.canPropose); assertTrue(gateway.proposals.isEmpty() && gateway.applications.isEmpty())
    }

    @Test fun accountAndTripScopesNeverLoadEachOthersDraft() = runBlocking {
        val first = state(); first.reload(null); requireNotNull(first.draft).price = "4,00"; first.close()
        val otherAccount = state(uid = "other"); otherAccount.reload(null)
        assertEquals("2,50", otherAccount.draft?.price)
        gateway.preview = { ChangeFixture.preview.copy(tripId = "another") }
        val otherTrip = state(trip = "another"); otherTrip.reload(null)
        assertEquals("2,50", otherTrip.draft?.price)
        assertEquals(setOf("driver" to "trip"), storage.records.keys)
    }

    @Test fun unknownProposalIsResolvedAfterReopeningWithoutAnotherSubmission() = runBlocking {
        val original = gateway.propose
        var recorded: TripChangeReview? = null
        gateway.propose = { recorded = original(it); throw IOException() }
        val first = state(); first.reload(null); requireNotNull(first.draft).price = "4,00"; first.propose {}; first.close()
        val request = requireNotNull(storage.records["driver" to "trip"]?.pendingProposal)
        gateway.resolve = { assertEquals(request, it); recorded }
        gateway.preview = { error("Resolution must precede preview") }
        val second = state(); second.reload(null)
        assertEquals(recorded, second.review); assertEquals(1, gateway.proposals.size)
        assertFalse(second.canPropose || second.applied); assertTrue(storage.records.isEmpty())
    }

    @Test fun unrecordedRequestCanOnlyBeResentExplicitlyWithSameIdentity() = runBlocking {
        gateway.propose = { throw IOException() }
        val first = state(); first.reload(null); requireNotNull(first.draft).price = "4,00"; first.propose {}; first.close()
        val second = state(); second.reload(null)
        assertEquals(1, gateway.proposals.size); assertTrue(second.canPropose)
        second.propose {}; assertEquals(gateway.proposals[0], gateway.proposals[1])
    }

    @Test fun editedInputDoesNotKeepAnObsoleteUnrecordedSubmission() = runBlocking {
        gateway.propose = { throw IOException() }
        val first = state(); first.reload(null); requireNotNull(first.draft).price = "4,00"; first.propose {}; first.reload(null)
        requireNotNull(first.draft).price = "5,00"; first.close()
        assertNull(storage.records["driver" to "trip"]?.pendingProposal)
        val second = state(); second.reload(null); second.propose {}
        assertNotEquals(gateway.proposals[0].requestId, gateway.proposals[1].requestId)
        assertEquals(500, gateway.proposals[1].terms.priceCents)
    }

    @Test fun staleDraftIsRetainedButCannotBeSubmittedUntilExplicitlyReplaced() = runBlocking {
        val first = state(); first.reload(null); requireNotNull(first.draft).price = "4,00"; first.close()
        val original = requireNotNull(storage.records["driver" to "trip"])
        gateway.preview = { ChangeFixture.preview.copy(revision = "e".repeat(64), terms = ChangeFixture.terms.copy(priceCents = 300)) }
        val second = state(); second.reload(null)
        assertTrue(second.draftConflict); assertEquals("4,00", second.draft?.price)
        second.propose { fail() }; assertTrue(gateway.proposals.isEmpty()); assertEquals(original, storage.records["driver" to "trip"])
        second.discardDraft(); assertFalse(second.draftConflict); assertEquals("3,00", second.draft?.price)
        assertEquals("e".repeat(64), storage.records["driver" to "trip"]?.revision)
    }

    @Test fun failedSaveKeepsTypedInputAndBlocksSubmissionUntilExplicitRetry() = runBlocking {
        val first = state(); first.reload(null); storage.failWrite = true
        requireNotNull(first.draft).price = "4,00"
        assertEquals("4,00", first.draft?.price); assertNotNull(first.draftSaveError); assertFalse(first.canPropose)
        first.propose { fail() }; assertTrue(gateway.proposals.isEmpty())
        storage.failWrite = false; first.saveDraft()
        assertNull(first.draftSaveError); assertTrue(first.canPropose)
        first.close(); val second = state(); second.reload(null); assertEquals("4,00", second.draft?.price)
    }

    @Test fun requestPersistenceFailurePreventsNetworkWrite() = runBlocking {
        val first = state(); first.reload(null); requireNotNull(first.draft).price = "4,00"; storage.failWrite = true
        first.propose {}; assertTrue(first.requiresReload); assertTrue(gateway.proposals.isEmpty())
    }

    @Test fun failedReadDoesNotCreateAnEmptyDraftOrWrite() = runBlocking {
        storage.failRead = true
        val first = state(); first.reload(null)
        assertTrue(first.requiresReload); assertNull(first.draft); assertFalse(first.canEdit)
        assertTrue(storage.records.isEmpty() && gateway.proposals.isEmpty())
    }

    @Test fun openingUnrelatedClosedHistoryNeverDeletesAnUnsentDraft() = runBlocking {
        val first = state(); first.reload(null); requireNotNull(first.draft).price = "4,00"; first.close()
        val saved = storage.records.toMap()
        val history = state(); history.reload(ChangeFixture.review.proposalId)
        assertEquals(saved, storage.records); assertNull(history.draft)
    }

    @Test fun parentReviewsNeverAccessDriverDraftStorage() = runBlocking {
        storage.failRead = true; storage.failWrite = true
        val parent = state(uid = "parent", role = AppRole.Parent); parent.reload(ChangeFixture.review.proposalId)
        assertNotNull(parent.review); assertFalse(parent.requiresReload)
    }
}
