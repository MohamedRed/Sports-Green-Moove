package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.MessageSendException
import be.sportgreenmoove.app.services.TeamConversationDraftRecord
import be.sportgreenmoove.app.services.TeamConversationDraftStorage
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class TeamConversationDraftStateTest {
    private val target = TeamConversationTarget("team", "a".repeat(64))
    private class Storage : TeamConversationDraftStorage {
        val records = mutableMapOf<Pair<String, TeamConversationTarget>, TeamConversationDraftRecord>()
        var failRead = false; var failWrite = false
        override fun read(uid: String, target: TeamConversationTarget): TeamConversationDraftRecord? {
            if (failRead) throw IOException("private diagnostic")
            return records[uid to target]
        }
        override fun write(uid: String, target: TeamConversationTarget, record: TeamConversationDraftRecord?) {
            if (failWrite) throw IOException("private diagnostic")
            if (record == null) records.remove(uid to target) else records[uid to target] = record
        }
    }
    private val storage = Storage()
    private fun state(uid: String = "parent", destination: TeamConversationTarget = target) =
        TeamConversationDraftState(uid, destination, storage).also { it.load() }
    private fun composer() = requireNotNull(state().composer)

    @Test fun anUnsentDraftIsRecoveredByANewStateWithoutAnyAutomaticSend() {
        composer().edit("  Message encore privé  ")
        val next = requireNotNull(state().composer)
        assertEquals("  Message encore privé  ", next.draft); assertNull(next.pendingId); assertFalse(next.sending)
        assertEquals(1, storage.records.size)
    }
    @Test fun accountsTeamsAndRecreatedTeamInstancesCannotLoadEachOthersDrafts() {
        composer().edit("Privé")
        for ((uid, destination) in listOf("other" to target, "parent" to TeamConversationTarget("other", "b".repeat(64)),
            "parent" to TeamConversationTarget("team", "c".repeat(64)))) {
            assertEquals("", state(uid, destination).composer?.draft)
        }
        assertEquals("Privé", state().composer?.draft); assertEquals(1, storage.records.size)
    }
    @Test fun anUnreadableDraftCannotCreateAnEmptyComposerOrOverwriteTheRecord() {
        composer().edit("Préservé"); val before = storage.records.toMap(); storage.failRead = true
        val broken = state(); assertNull(broken.composer); assertNotNull(broken.error)
        assertFalse(requireNotNull(broken.error).contains("private")); assertEquals(before, storage.records)
        storage.failRead = false; broken.load()
        assertEquals("Préservé", broken.composer?.draft); assertNull(broken.error)
    }
    @Test fun aFailedEditKeepsTypedTextAndPreventsNetworkSubmissionUntilStorageWorks() = runBlocking {
        val current = composer(); storage.failWrite = true; current.edit("À conserver")
        assertEquals("À conserver", current.draft); assertNotNull(current.error)
        var requests = 0
        current.sendOperation({ _, _ -> requests++; "message" }) { false }
        assertEquals(0, requests); assertNull(current.pendingId)
        storage.failWrite = false
        current.sendOperation({ _, _ -> requests++; "message" }) { false }
        assertEquals(1, requests); assertEquals("", current.draft); assertTrue(storage.records.isEmpty())
    }
    @Test fun theIntentIsDurableBeforeSendingAndCancellationRestoresTheSameLockedRequest() = runBlocking {
        val first = composer(); first.edit("Envoi interrompu")
        var firstId: String? = null
        val job = launch(start = CoroutineStart.UNDISPATCHED) {
            first.sendOperation({ body, id ->
                firstId = id; assertEquals(body, storage.records["parent" to target]?.body)
                assertEquals(id, storage.records["parent" to target]?.requestId); awaitCancellation()
            }) { false }
        }
        job.cancelAndJoin()
        val next = requireNotNull(state().composer)
        assertEquals(firstId, next.pendingId); assertTrue(next.locked); assertNotNull(next.error)
        next.edit("Ne pas remplacer"); assertEquals("Envoi interrompu", next.draft)
        next.sendOperation({ _, id -> assertEquals(firstId, id); "message" }) { false }
        assertEquals("", next.draft); assertTrue(storage.records.isEmpty())
    }
    @Test fun aRejectedRetryCannotEraseAnEarlierUncertainIntent() = runBlocking {
        val first = composer(); first.edit("Incertain")
        first.sendOperation({ _, _ -> throw MessageSendException(false, IOException()) }) { false }
        val id = first.pendingId; val next = requireNotNull(state().composer)
        next.sendOperation({ _, request -> assertEquals(id, request); throw MessageSendException(true, IOException()) }) { false }
        assertEquals(id, next.pendingId); assertEquals(id, storage.records["parent" to target]?.requestId)
    }
    @Test fun aSuccessfulSendClearsDurableStateAndANewInstanceStaysEmpty() = runBlocking {
        val current = composer(); current.edit("Une fois")
        current.sendOperation({ _, _ -> "message" }) { false }
        assertEquals("", state().composer?.draft); assertNull(state().composer?.pendingId); assertTrue(storage.records.isEmpty())
    }
    @Test fun failureToPersistAnAcknowledgementKeepsItsOriginalIdentityAndNeverSendsAutomatically() = runBlocking {
        val current = composer(); current.edit("Confirmé côté serveur")
        var calls = 0
        current.sendOperation({ _, _ -> calls++; storage.failWrite = true; "message" }) { false }
        val id = current.pendingId; assertNotNull(id); assertNotNull(current.error); assertEquals(1, calls)
        storage.failWrite = false
        val next = requireNotNull(state().composer); assertEquals(id, next.pendingId); assertEquals(1, calls)
        next.acknowledge("another"); assertEquals(id, next.pendingId)
        next.acknowledge(requireNotNull(id)); assertTrue(storage.records.isEmpty()); assertEquals("", state().composer?.draft)
    }
    @Test fun aFirstDefinitiveRejectionRemovesOnlyThePendingIdAndStillRestoresTheText() = runBlocking {
        val current = composer(); current.edit("À corriger")
        current.sendOperation({ _, _ -> throw MessageSendException(true, IOException()) }) { false }
        val next = requireNotNull(state().composer)
        assertEquals("À corriger", next.draft); assertNull(next.pendingId); assertFalse(next.locked)
    }
    @Test fun invalidRecordIdentitiesAndUnboundedStoredTextAreRejected() {
        for ((body, id) in listOf("x".repeat(16_385) to null, "" to "00000000-0000-0000-0000-000000000000",
            "x" to "invalid", "x".repeat(1001) to "00000000-0000-0000-0000-000000000000")) {
            assertThrows(IllegalArgumentException::class.java) { TeamConversationDraftRecord(body, id) }
        }
    }
}
