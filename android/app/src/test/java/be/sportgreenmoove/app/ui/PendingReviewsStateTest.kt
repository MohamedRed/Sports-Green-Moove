package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.data.PendingReviewPage
import be.sportgreenmoove.app.services.PendingReviewGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.*
import org.junit.Test

class PendingReviewsStateTest {
    private fun review(id: String) = InboxReviewPrompt(id, id, "driver", "Avis", "Votre avis ?", "AV")
    @Test fun emptyContinuationCanAdvanceToARealReviewAndThenToTheEnd() = runBlocking {
        var calls = 0
        val state = PendingReviewsState("parent", object : PendingReviewGateway {
            override suspend fun loadPendingReviews(cursor: String): PendingReviewPage {
                calls++; return if (cursor == "one") PendingReviewPage("parent", emptyList(), "two")
                else PendingReviewPage("parent", listOf(review("late")), null)
            }
        })
        state.replace(emptyList(), "one"); state.loadMore()
        assertTrue(state.items.isEmpty()); assertEquals("two", state.nextCursor)
        state.loadMore(); state.loadMore()
        assertEquals(listOf("late"), state.items.map { it.id }); assertNull(state.nextCursor); assertEquals(2, calls)
    }
    @Test fun failedPagePreservesRowsAndCursorForExplicitRetry() = runBlocking {
        var fail = true
        val state = PendingReviewsState("parent", object : PendingReviewGateway {
            override suspend fun loadPendingReviews(cursor: String): PendingReviewPage {
                if (fail) error("offline")
                return PendingReviewPage("parent", listOf(review("next")), null)
            }
        })
        state.replace(listOf(review("first")), "one"); state.loadMore()
        assertNotNull(state.error); assertEquals("one", state.nextCursor); assertEquals(1, state.items.size)
        fail = false; state.loadMore(); assertNull(state.error); assertEquals(2, state.items.size)
    }
    @Test fun duplicateRowsAndSubmittedReviewsCannotReappearOnLaterPagesOrRefresh() = runBlocking {
        val state = PendingReviewsState("parent", object : PendingReviewGateway {
            override suspend fun loadPendingReviews(cursor: String) = PendingReviewPage("parent", listOf(review("first"), review("last")), null)
        })
        state.replace(listOf(review("first")), "one"); state.submitted("last"); state.loadMore()
        assertEquals(listOf("first"), state.items.map { it.id })
        state.replace(listOf(review("first"), review("last")), null)
        assertEquals(listOf("first"), state.items.map { it.id })
    }
    @Test fun anotherOwnerAndNonAdvancingCursorFailWithoutReplacingData() = runBlocking {
        for (response in listOf(PendingReviewPage("other", listOf(review("foreign")), null), PendingReviewPage("parent", emptyList(), "one"))) {
            val state = PendingReviewsState("parent", object : PendingReviewGateway {
                override suspend fun loadPendingReviews(cursor: String) = response
            })
            state.replace(listOf(review("first")), "one"); state.loadMore()
            assertNotNull(state.error); assertEquals(listOf("first"), state.items.map { it.id }); assertEquals("one", state.nextCursor)
        }
    }
    @Test fun refreshOrDisposalDiscardsLateRepliesAndConcurrentLoadsAreSuppressed() = runBlocking {
        for (close in listOf(false, true)) {
            val reply = CompletableDeferred<PendingReviewPage>(); var calls = 0
            val state = PendingReviewsState("parent", object : PendingReviewGateway {
                override suspend fun loadPendingReviews(cursor: String): PendingReviewPage { calls++; return reply.await() }
            })
            state.replace(listOf(review("first")), "one")
            val job = launch { state.loadMore() }; yield(); state.loadMore()
            assertEquals(1, calls)
            if (close) state.close() else state.replace(listOf(review("fresh")), "replacement")
            reply.complete(PendingReviewPage("parent", listOf(review("stale")), null)); job.join()
            assertEquals(if (close) emptyList<String>() else listOf("fresh"), state.items.map { it.id })
            assertEquals(if (close) null else "replacement", state.nextCursor); assertFalse(state.loading)
        }
    }
    @Test fun cancellationDoesNotConsumeTheCursorOrBecomeAZeroReviewResult() = runBlocking {
        val reply = CompletableDeferred<PendingReviewPage>()
        val state = PendingReviewsState("parent", object : PendingReviewGateway {
            override suspend fun loadPendingReviews(cursor: String) = reply.await()
        })
        state.replace(listOf(review("first")), "one")
        val job = launch { state.loadMore() }; yield(); job.cancel(); job.join()
        assertNull(state.error); assertFalse(state.loading); assertEquals("one", state.nextCursor); assertEquals(1, state.items.size)
    }
}
