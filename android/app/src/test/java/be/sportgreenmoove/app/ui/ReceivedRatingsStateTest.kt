package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ReceivedRatingSummary
import be.sportgreenmoove.app.services.ReceivedRatingsGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class ReceivedRatingsStateTest {
    @Test fun zeroAndHistoricalRatingsAreReadWithoutInventingAScore() = runBlocking {
        val gateway = RatingFixture(); val state = ReceivedRatingsState("parent", gateway)
        assertNull(state.summary); state.refresh(); assertEquals(ReceivedRatingSummary("parent", 0, null), state.summary)
        gateway.value = ReceivedRatingSummary("parent", 104, 358.0 / 104); state.refresh()
        assertEquals(gateway.value, state.summary); assertFalse(state.failed)
    }
    @Test fun failureClearsTheOldScoreAndExplicitRetryReadsFreshData() = runBlocking {
        val gateway = RatingFixture().apply { value = ReceivedRatingSummary("parent", 1, 5.0) }
        val state = ReceivedRatingsState("parent", gateway); state.refresh()
        gateway.fail = true; state.refresh(); assertNull(state.summary); assertTrue(state.failed)
        gateway.fail = false; gateway.value = ReceivedRatingSummary("parent", 2, 3.0)
        state.refresh(); assertEquals(gateway.value, state.summary); assertFalse(state.failed)
    }
    @Test fun closingDiscardsAnOldAccountsLateResponse() = runBlocking {
        val gateway = RatingFixture().apply { held = CompletableDeferred() }; val state = ReceivedRatingsState("parent", gateway)
        val reading = launch(start = CoroutineStart.UNDISPATCHED) { state.refresh() }
        state.close(); gateway.held!!.complete(ReceivedRatingSummary("parent", 1, 5.0)); reading.join()
        assertNull(state.summary); assertFalse(state.busy); assertFalse(state.failed)
        state.refresh(); assertEquals(1, gateway.calls)
    }
    @Test fun cancellationPropagatesWithoutLeavingAnInventedEmptySummary() = runBlocking {
        val state = ReceivedRatingsState("parent", object : ReceivedRatingsGateway {
            override suspend fun readReceivedRatings(uid: String): ReceivedRatingSummary = throw CancellationException()
        })
        assertTrue(runCatching { state.refresh() }.exceptionOrNull() is CancellationException)
        assertNull(state.summary); assertFalse(state.busy); assertFalse(state.failed)
    }
    @Test fun foreignResultFailsClosed() = runBlocking {
        val gateway = RatingFixture().apply { value = ReceivedRatingSummary("driver", 50, 4.0) }
        val state = ReceivedRatingsState("parent", gateway); state.refresh()
        assertNull(state.summary); assertTrue(state.failed)
    }
    @Test fun repeatedRefreshWhileWaitingCannotReadTwice() = runBlocking {
        val gateway = RatingFixture().apply { held = CompletableDeferred() }; val state = ReceivedRatingsState("parent", gateway)
        val reading = launch(start = CoroutineStart.UNDISPATCHED) { state.refresh() }
        state.refresh(); assertEquals(1, gateway.calls); assertTrue(state.busy)
        gateway.held!!.complete(gateway.value); reading.join(); assertFalse(state.busy)
    }
}

private class RatingFixture : ReceivedRatingsGateway {
    var value = ReceivedRatingSummary("parent", 0, null)
    var fail = false; var calls = 0; var held: CompletableDeferred<ReceivedRatingSummary>? = null
    override suspend fun readReceivedRatings(uid: String): ReceivedRatingSummary {
        calls++; if (fail) error("Isolated read failure")
        return held?.await() ?: value
    }
}
