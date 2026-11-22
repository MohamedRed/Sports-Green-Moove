package be.sportgreenmoove.app.ui

import androidx.compose.runtime.mutableStateOf
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.ConversationGateway
import be.sportgreenmoove.app.services.MessageSendException
import be.sportgreenmoove.app.services.UnconfiguredConversationGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class ConversationComposerStateTest {
    private val ref = ConversationRef(ConversationKind.Booking, "booking-1")
    private data class Request(val body: String, val id: String)
    private class Gateway : ConversationGateway by UnconfiguredConversationGateway() {
        val requests = mutableListOf<Request>()
        var failure: Exception? = null
        var beforeResult: suspend () -> Unit = {}
        override suspend fun sendMessage(ref: ConversationRef, body: String, requestId: String): String {
            requests += Request(body, requestId)
            beforeResult()
            failure?.let { throw it }
            return "stored-message"
        }
    }
    private suspend fun ConversationComposerState.send(gateway: Gateway) = send(ref, gateway) { false }

    @Test fun anUncertainAttemptKeepsItsIdentityEvenWhenTheRetryIsDefinitelyRejected() = runBlocking {
        val state = ConversationComposerState()
        val gateway = Gateway().apply { failure = MessageSendException(false, IOException()) }
        state.edit("Nous arrivons.")
        state.send(gateway)
        val original = state.pendingId
        assertNotNull(original)
        gateway.failure = MessageSendException(true, IllegalArgumentException())
        state.send(gateway)
        assertEquals(original, state.pendingId)
        assertEquals("Nous arrivons.", state.draft)
        assertEquals("Envoi non confirmé. Réessayez.", state.error)
        state.edit("Ne doit pas remplacer un envoi incertain")
        assertEquals("Nous arrivons.", state.draft)
        gateway.failure = null
        state.send(gateway)
        assertEquals(3, gateway.requests.size)
        assertEquals(1, gateway.requests.map { it.id }.distinct().size)
        assertEquals(1, gateway.requests.map { it.body }.distinct().size)
        assertEquals("", state.draft)
        assertFalse(state.locked)
    }

    @Test fun aFirstDefinitiveRejectionStillAllowsEditingANewIntent() = runBlocking {
        val state = ConversationComposerState()
        val gateway = Gateway().apply { failure = MessageSendException(true, IllegalArgumentException()) }
        state.edit("Premier message")
        state.send(gateway)
        assertNull(state.pendingId)
        assertEquals("Envoi refusé. Vérifiez le message et réessayez.", state.error)
        state.edit("Message corrigé")
        assertNull(state.error)
        gateway.failure = null
        state.send(gateway)
        assertNotEquals(gateway.requests[0].id, gateway.requests[1].id)
        assertEquals("Message corrigé", gateway.requests[1].body)
    }

    @Test fun cancellationAndSavedHolderRecreationDoNotMakeAPendingIntentFreshAgain() = runBlocking {
        val draft = mutableStateOf("Envoi interrompu")
        val pending = mutableStateOf<String?>(null)
        val state = ConversationComposerState(draft, pending)
        val gateway = Gateway().apply { beforeResult = { awaitCancellation() } }
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.send(gateway) }
        assertTrue(state.sending)
        val original = state.pendingId
        job.cancelAndJoin()
        assertFalse(state.sending)
        val restored = ConversationComposerState(draft, pending)
        gateway.beforeResult = {}
        gateway.failure = MessageSendException(true, IllegalStateException())
        restored.send(gateway)
        assertEquals(original, restored.pendingId)
        assertEquals("Envoi interrompu", restored.draft)
        gateway.failure = null
        restored.send(gateway)
        assertEquals(1, gateway.requests.map { it.id }.distinct().size)
    }

    @Test fun overlappingSendsAndEditsCannotReplaceTheInFlightIntent() = runBlocking {
        val result = CompletableDeferred<Unit>()
        val state = ConversationComposerState()
        val gateway = Gateway().apply { beforeResult = { result.await() } }
        state.edit("Un seul envoi")
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.send(gateway) }
        state.edit("Autre texte")
        state.send(gateway)
        assertEquals(1, gateway.requests.size)
        assertEquals("Un seul envoi", state.draft)
        result.complete(Unit)
        job.join()
        assertFalse(state.sending)
        assertNull(state.pendingId)
        assertEquals("", state.draft)
    }

    @Test fun aVisibleOwnAcknowledgementConfirmsEvenAnExceptionAndStaleAcknowledgementsAreIgnored() = runBlocking {
        val state = ConversationComposerState()
        val gateway = Gateway().apply { failure = MessageSendException(false, IOException()) }
        state.edit("Message confirmé")
        state.send(ref, gateway) { true }
        val oldId = gateway.requests.single().id
        assertEquals("", state.draft)
        assertNull(state.pendingId)
        assertNull(state.error)
        state.edit("Prochain message")
        state.send(gateway)
        val nextId = state.pendingId
        state.acknowledge(oldId)
        assertEquals("Prochain message", state.draft)
        assertEquals(nextId, state.pendingId)
        state.acknowledge(requireNotNull(nextId))
        assertEquals("", state.draft)
        assertNull(state.error)
    }

    @Test fun blankOrOversizedDraftsNeverAllocateAnIntentOrReachTheGateway() = runBlocking {
        val state = ConversationComposerState()
        val gateway = Gateway()
        for (body in listOf("  ", "x".repeat(1001))) {
            state.edit(body)
            state.send(gateway)
            assertNull(state.pendingId)
            assertTrue(gateway.requests.isEmpty())
        }
    }

    @Test fun anObservedConfirmationCannotBeUndoneByALateSendFailure() = runBlocking {
        val result = CompletableDeferred<Unit>()
        val state = ConversationComposerState()
        val gateway = Gateway().apply {
            beforeResult = { result.await() }
            failure = MessageSendException(false, IOException())
        }
        state.edit("Déjà confirmé")
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.send(gateway) }
        state.acknowledge(requireNotNull(state.pendingId))
        assertEquals("", state.draft)
        result.complete(Unit)
        job.join()
        assertNull(state.pendingId)
        assertNull(state.error)
        assertFalse(state.sending)
    }
}
