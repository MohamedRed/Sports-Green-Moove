package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.data.ReviewTripContext
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredConversationGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.yield
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class ReviewSubmissionStateTest {
    private fun review(id: String) = InboxReviewPrompt(id, id, "driver", "Avis", "Votre avis ?", "AV",
        ReviewTripContext(id, "Entraînement U12", "2026-10-29T17:45:00Z", "$id octobre 2026 à 18:45"))
    private fun state(send: suspend (String, String, Int) -> String): MessagesInboxState {
        val gateway = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?) =
                send(rideSessionId, ratedUserId, score)
        }
        return MessagesInboxState("parent", gateway, UnconfiguredConversationGateway()).apply {
            reviews.replace(listOf(review("28"), review("29")), "next-page")
        }
    }
    @Test fun failedSendKeepsAllContextAndContinuationWithoutReplacingTheInboxWithAnError() = runBlocking {
        val state = state { _, _, _ -> throw IOException("network unavailable") }
        val original = state.reviews.items
        state.submitReview("29", "29", "driver", 5)
        assertNull(state.error); assertNull(state.notice); assertNull(state.submittingReviewId)
        assertEquals("29", state.reviewFailure?.reviewId); assertNotNull(state.reviewFailure?.message)
        assertEquals(original, state.reviews.items); assertEquals("next-page", state.reviews.nextCursor)
    }
    @Test fun explicitRetryReusesTheSameTripAndOnlyRemovesItsAcknowledgedReview() = runBlocking {
        val attempts = mutableListOf<Triple<String, String, Int>>()
        val state = state { ride, user, score ->
            attempts += Triple(ride, user, score)
            if (attempts.size == 1) throw IOException("network unavailable")
            "receipt"
        }
        repeat(2) { state.submitReview("29", "29", "driver", 5) }
        assertEquals(List(2) { Triple("29", "driver", 5) }, attempts)
        assertEquals(listOf(review("28")), state.reviews.items); assertEquals("next-page", state.reviews.nextCursor)
        assertEquals("Avis envoyé.", state.notice); assertNull(state.reviewFailure); assertNull(state.error)
    }
    @Test fun overlappingClicksCannotSubmitAnotherTripUntilTheFirstSendSettles() = runBlocking {
        val reply = CompletableDeferred<String>(); var calls = 0
        val state = state { _, _, _ -> calls++; reply.await() }
        val first = launch { state.submitReview("29", "29", "driver", 5) }; yield()
        state.submitReview("28", "28", "driver", 4)
        assertEquals(1, calls); assertEquals("29", state.submittingReviewId)
        reply.complete("receipt"); first.join()
        assertEquals(listOf(review("28")), state.reviews.items); assertNull(state.submittingReviewId)
    }
    @Test fun cancellationKeepsTheReviewWithoutPretendingTheServerRejectedOrAcknowledgedIt() = runBlocking {
        val reply = CompletableDeferred<String>()
        val state = state { _, _, _ -> reply.await() }
        val job = launch { state.submitReview("29", "29", "driver", 5) }; yield(); job.cancel(); job.join()
        assertNull(state.reviewFailure); assertNull(state.notice); assertNull(state.error); assertNull(state.submittingReviewId)
        assertEquals(2, state.reviews.items.size)
    }
    @Test fun accountDisposalRejectsLateAcknowledgementsAndLateErrors() = runBlocking {
        for (succeed in listOf(false, true)) {
            val reply = CompletableDeferred<String>(); var calls = 0
            val state = state { _, _, _ -> calls++; withContext(NonCancellable) { reply.await() } }
            val job = launch { state.submitReview("29", "29", "driver", 5) }; yield(); state.close()
            if (succeed) reply.complete("receipt") else reply.completeExceptionally(IOException("network unavailable"))
            job.join(); state.submitReview("28", "28", "driver", 4)
            assertEquals(1, calls); assertTrue(state.reviews.items.isEmpty()); assertNull(state.reviews.nextCursor)
            assertNull(state.notice); assertNull(state.reviewFailure); assertNull(state.submittingReviewId)
        }
    }
}
