package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.ConversationDraftRecord
import be.sportgreenmoove.app.services.ConversationDraftStorage
import be.sportgreenmoove.app.services.MessageSendException
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class ConversationDraftStateTest {
    private val ref = ConversationRef(ConversationKind.Booking, "booking")
    private class Storage : ConversationDraftStorage {
        val records = mutableMapOf<Pair<String, ConversationRef>, ConversationDraftRecord>()
        var failRead = false; var failWrite = false
        override fun read(uid: String, ref: ConversationRef): ConversationDraftRecord? {
            if (failRead) throw IOException("private diagnostic")
            return records[uid to ref]
        }
        override fun write(uid: String, ref: ConversationRef, record: ConversationDraftRecord?) {
            if (failWrite) throw IOException("private diagnostic")
            if (record == null) records.remove(uid to ref) else records[uid to ref] = record
        }
    }
    private val storage = Storage()
    private fun state(uid: String = "parent", target: ConversationRef = ref) =
        ConversationDraftState(uid, target, storage).also { it.load() }
    private fun composer() = requireNotNull(state().composer)

    @Test fun aNewStateRestoresAnUnsentDraftWithoutSubmittingAnything() {
        composer().edit("  brouillon prive qa avant fermeture  ")
        val restored = requireNotNull(state().composer)
        assertEquals("  brouillon prive qa avant fermeture  ", restored.draft)
        assertNull(restored.pendingId); assertFalse(restored.sending)
    }
    @Test fun draftsAreIsolatedByAccountConversationAndSourceKind() {
        composer().edit("Private")
        for ((uid, target) in listOf("other" to ref,
            "parent" to ConversationRef(ConversationKind.Booking, "other"),
            "parent" to ConversationRef(ConversationKind.RideSession, ref.sourceId))) {
            assertEquals("", state(uid, target).composer?.draft)
        }
        assertEquals("Private", state().composer?.draft); assertEquals(1, storage.records.size)
    }
    @Test fun readFailureNeverReplacesAnExistingDraftWithAnEmptyComposer() {
        composer().edit("Preserved"); storage.failRead = true
        val broken = state(); assertNull(broken.composer); assertNotNull(broken.error)
        assertFalse(requireNotNull(broken.error).contains("private diagnostic"))
        storage.failRead = false; broken.load(); assertEquals("Preserved", broken.composer?.draft)
    }
    @Test fun writeFailurePreservesVisibleTextAndPreventsANetworkSend() = runBlocking {
        val composer = composer(); storage.failWrite = true; composer.edit("Private")
        var calls = 0
        composer.sendOperation({ _, _ -> calls++; "message" }) { false }
        assertEquals(0, calls); assertEquals("Private", composer.draft); assertNull(composer.pendingId)
        storage.failWrite = false
        composer.sendOperation({ _, _ -> calls++; "message" }) { false }
        assertEquals(1, calls); assertTrue(storage.records.isEmpty())
    }
    @Test fun interruptionRestoresTheSameDurablePendingIdentityBeforeAnyExplicitRetry() = runBlocking {
        val first = composer(); first.edit("Uncertain")
        var requestId: String? = null
        val job = launch(start = CoroutineStart.UNDISPATCHED) {
            first.sendOperation({ body, id ->
                requestId = id; assertEquals(ConversationDraftRecord(body, id), storage.records["parent" to ref])
                awaitCancellation()
            }) { false }
        }
        job.cancelAndJoin()
        val restored = requireNotNull(state().composer)
        assertEquals(requestId, restored.pendingId); assertTrue(restored.locked); assertFalse(restored.sending)
        restored.edit("Do not replace"); assertEquals("Uncertain", restored.draft)
        restored.sendOperation({ _, id -> assertEquals(requestId, id); "message" }) { false }
        assertTrue(storage.records.isEmpty()); assertEquals("", state().composer?.draft)
    }
    @Test fun aRejectedRetryCannotEraseAnEarlierUncertainIntent() = runBlocking {
        val first = composer(); first.edit("Uncertain")
        first.sendOperation({ _, _ -> throw MessageSendException(false, IOException()) }) { false }
        val id = first.pendingId; val restored = requireNotNull(state().composer)
        restored.sendOperation({ _, next -> assertEquals(id, next); throw MessageSendException(true, IOException()) }) { false }
        assertEquals(id, state().composer?.pendingId); assertEquals("Uncertain", state().composer?.draft)
    }
    @Test fun failedAcknowledgementStorageRetainsTheOriginalIdentityUntilItCanBeCleared() = runBlocking {
        val composer = composer(); composer.edit("Confirmed remotely")
        composer.sendOperation({ _, _ -> storage.failWrite = true; "message" }) { false }
        val id = requireNotNull(composer.pendingId); storage.failWrite = false
        val restored = requireNotNull(state().composer); restored.acknowledge("other")
        assertEquals(id, restored.pendingId); restored.acknowledge(id)
        assertTrue(storage.records.isEmpty()); assertEquals("", state().composer?.draft)
    }
    @Test fun aFirstDefinitiveRejectionRestoresEditableTextButNoPendingIdentity() = runBlocking {
        val composer = composer(); composer.edit("Please correct")
        composer.sendOperation({ _, _ -> throw MessageSendException(true, IOException()) }) { false }
        assertEquals("Please correct", state().composer?.draft); assertNull(state().composer?.pendingId)
    }
    @Test fun invalidStoredBodiesAndRequestIdentitiesAreRejected() {
        for ((body, id) in listOf("x".repeat(16_385) to null, "" to "00000000-0000-0000-0000-000000000000",
            "x" to "invalid", "x".repeat(1001) to "00000000-0000-0000-0000-000000000000")) {
            assertThrows(IllegalArgumentException::class.java) { ConversationDraftRecord(body, id) }
        }
    }
}
