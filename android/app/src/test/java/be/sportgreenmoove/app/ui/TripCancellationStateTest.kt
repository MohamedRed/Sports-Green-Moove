package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TripCancellationGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class TripCancellationStateTest {
    private val ready = TripCancellationReady("trip", "a".repeat(64), 2, 1)
    private fun receipt(request: TripCancellationRequest) = TripCancellationReceipt(request.tripId, request.requestId,
        request.expectedRevision, request.reason, "driver", "2026-10-16T12:00:00Z", listOf("paid", "pending"), 1, 3)
    private inner class Gateway : TripCancellationGateway {
        val requests = mutableListOf<TripCancellationRequest>()
        var read: suspend () -> TripCancellationPreview = { ready }
        var write: suspend (TripCancellationRequest) -> TripCancellationReceipt = { receipt(it) }
        override suspend fun previewTripCancellation(tripId: String) = read()
        override suspend fun cancelTrip(request: TripCancellationRequest): TripCancellationReceipt { requests += request; return write(request) }
    }
    private suspend fun state(gateway: Gateway) = TripCancellationState("trip", gateway).also {
        it.reload {}; it.editReason("  Match reporté  ")
    }

    @Test fun requiresAnAuthoritativePreviewAndValidReason() = runBlocking {
        val gateway = Gateway()
        val state = TripCancellationState("trip", gateway)
        state.confirm { fail() }
        assertTrue(gateway.requests.isEmpty())
        state.reload {}
        for (reason in listOf("", "   ", "abcd")) { state.editReason(reason); assertFalse(state.canConfirm) }
        state.editReason("x".repeat(300)); assertTrue(state.canConfirm)
        state.editReason("x".repeat(301)); assertEquals(300, state.reason.length)
        state.editReason("  Match reporté  ")
        state.confirm {}
        assertEquals("Match reporté", gateway.requests.single().reason)
        assertTrue(state.confirmed)
        state.confirm { fail() }
        assertEquals(1, gateway.requests.size)
    }

    @Test fun uncertaintyLocksDraftUntilRefreshAndPreservesExactIntent() = runBlocking {
        val gateway = Gateway().apply { write = { throw IOException("ambiguous") } }
        val state = state(gateway)
        state.confirm {}
        assertFalse(state.confirmed || state.canConfirm || state.canEdit)
        assertTrue(state.requiresReload)
        state.editReason("Autre motif")
        state.confirm { fail() }
        assertEquals(1, gateway.requests.size)
        state.reload {}
        gateway.write = { receipt(it) }
        state.confirm {}
        assertEquals(gateway.requests[0], gateway.requests[1])
    }

    @Test fun changedRevisionRequiresReviewAndANewRequest() = runBlocking {
        val gateway = Gateway().apply { write = { throw IOException() } }
        val state = state(gateway)
        state.confirm {}
        gateway.read = { ready.copy(revision = "b".repeat(64), bookingCount = 3) }
        state.reload {}
        assertNotNull(state.notice)
        assertEquals(1, gateway.requests.size)
        gateway.write = { receipt(it) }
        state.confirm {}
        assertNotEquals(gateway.requests[0].requestId, gateway.requests[1].requestId)
        assertEquals("b".repeat(64), gateway.requests[1].expectedRevision)
    }

    @Test fun confirmedCancellationIsRetainedWhenAppRefreshFails() = runBlocking {
        val gateway = Gateway()
        val state = state(gateway)
        state.confirm { throw IOException() }
        val confirmed = state.preview
        assertTrue(state.confirmed && state.requiresReload)
        assertEquals("Trajet annulé. Actualisez pour revoir la liste.", state.error)
        state.confirm { fail() }
        gateway.read = { requireNotNull(confirmed) }
        var refreshed = false
        state.reload { refreshed = true }
        assertTrue(refreshed)
        assertFalse(state.requiresReload)
        assertEquals(1, gateway.requests.size)
    }

    @Test fun refreshDiscoversRecordedCancellationWithoutAnotherWrite() = runBlocking {
        val gateway = Gateway().apply { write = { throw IOException() } }
        val state = state(gateway)
        state.confirm {}
        val recorded = receipt(gateway.requests.single()).copy(actorUserId = "admin", requestId = java.util.UUID.randomUUID().toString())
        gateway.read = { recorded }
        state.reload {}
        assertEquals(recorded, state.preview)
        assertTrue(state.confirmed)
        assertEquals(1, gateway.requests.size)
    }

    @Test fun overlappingActionsAndEditsDoNotDispatch() = runBlocking {
        val gateway = Gateway()
        val reply = CompletableDeferred<TripCancellationReceipt>()
        gateway.write = { reply.await() }
        val state = state(gateway)
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.confirm {} }
        state.confirm { fail() }; state.reload { fail() }; state.editReason("Nouvelle raison")
        assertEquals(1, gateway.requests.size)
        assertEquals("  Match reporté  ", state.reason)
        reply.complete(receipt(gateway.requests.single())); first.join()
    }

    @Test fun closingDropsPrivateStateAndIgnoresLateWrite() = runBlocking {
        val gateway = Gateway()
        val reply = CompletableDeferred<TripCancellationReceipt>()
        gateway.write = { withContext(NonCancellable) { reply.await() } }
        val state = state(gateway)
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.confirm { fail() } }
        state.close()
        reply.complete(receipt(gateway.requests.single())); first.join()
        assertNull(state.preview); assertNull(state.error); assertEquals("", state.reason)
        assertFalse(state.busy || state.canConfirm)
    }

    @Test fun closingIgnoresLateReadAndCallback() = runBlocking {
        val gateway = Gateway()
        val reply = CompletableDeferred<TripCancellationPreview>()
        gateway.read = { withContext(NonCancellable) { reply.await() } }
        val state = TripCancellationState("trip", gateway)
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.reload { fail() } }
        state.close(); reply.complete(ready); first.join()
        assertNull(state.preview); assertNull(state.error); assertFalse(state.busy)
    }

    @Test fun invalidReceiptNeverClaimsSuccessOrRefreshes() = runBlocking {
        val gateway = Gateway().apply { write = { receipt(it).copy(tripId = "foreign") } }
        val state = state(gateway)
        state.confirm { fail() }
        assertTrue(state.requiresReload)
        assertFalse(state.confirmed)
    }
}
