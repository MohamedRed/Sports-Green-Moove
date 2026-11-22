package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AuthSession
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class SessionRestorationStateTest {
    private val session = AuthSession("parent", null, null)

    @Test fun genuineSignedOutStateIsDeliveredOnlyAfterSuccessfulRead() = runBlocking {
        val state = SessionRestorationState { null }
        assertEquals(SessionRestorationPhase.Pending, state.phase)
        var delivered = false
        state.restore { assertNull(it); delivered = true }
        assertTrue(delivered); assertEquals(SessionRestorationPhase.Ready, state.phase)
    }

    @Test fun transportFailureNeverBecomesSignedOutOrAutomaticallyRetries() = runBlocking {
        var reads = 0
        val state = SessionRestorationState { reads++; throw IOException("unexpected end of stream") }
        state.restore { fail("Failed restoration cannot publish a session, including null") }
        assertEquals(SessionRestorationPhase.Failed, state.phase)
        state.restore { fail() }
        assertEquals(1, reads)
    }

    @Test fun explicitRetryRestoresTheSameIdentityOnce() = runBlocking {
        var reads = 0
        val state = SessionRestorationState { if (++reads == 1) throw IOException() else session }
        state.restore { fail() }
        state.retry(); state.retry()
        assertEquals(1, state.attempt)
        state.restore { assertEquals(session, it) }
        state.restore { fail() }
        assertEquals(2, reads); assertEquals(SessionRestorationPhase.Ready, state.phase)
    }

    @Test fun inFlightReadBlocksAdditionalReadsRetryAndDisconnect() = runBlocking {
        val reply = CompletableDeferred<AuthSession?>()
        val state = SessionRestorationState { reply.await() }
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.restore { assertEquals(session, it) } }
        assertEquals(SessionRestorationPhase.Loading, state.phase)
        state.restore { fail() }; state.retry(); state.disconnect({ fail() }) { fail() }
        assertEquals(0, state.attempt)
        reply.complete(session); first.join()
    }

    @Test fun disconnectIsAnExplicitActionNotAnErrorFallback() = runBlocking {
        var signOuts = 0
        val state = SessionRestorationState { throw IOException() }
        state.disconnect({ fail() }) { fail() }
        state.restore { fail() }
        assertEquals(0, signOuts)
        state.disconnect({ signOuts++ }) { assertNull(it) }
        assertEquals(1, signOuts); assertEquals(SessionRestorationPhase.Ready, state.phase)
        state.disconnect({ fail() }) { fail() }
    }

    @Test fun failedDisconnectDoesNotPublishSignedOutState() = runBlocking {
        val state = SessionRestorationState { throw IOException() }
        state.restore { fail() }
        state.disconnect({ throw IOException() }) { fail() }
        assertEquals(SessionRestorationPhase.Failed, state.phase)
    }

    @Test fun disposalRejectsLateNonCancellableResults() = runBlocking {
        val reply = CompletableDeferred<AuthSession?>()
        val state = SessionRestorationState { withContext(NonCancellable) { reply.await() } }
        val task = launch(start = CoroutineStart.UNDISPATCHED) { state.restore { fail("Disposed screen cannot publish identity") } }
        state.close(); reply.complete(session); task.join()
        state.retry(); state.restore { fail() }
        assertEquals(0, state.attempt)
    }

    @Test fun lifecycleCancellationIsPropagatedNotDisplayedAsFailure() = runBlocking {
        val cancelled = CancellationException("disposed")
        val state = SessionRestorationState { throw cancelled }
        try { state.restore { fail() }; fail() }
        catch (actual: CancellationException) { assertSame(cancelled, actual) }
        assertNotEquals(SessionRestorationPhase.Failed, state.phase)
    }
}
