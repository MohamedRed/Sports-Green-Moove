package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.services.NotificationReadGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class NotificationReadStateTest {
    private val note = InboxNotificationSummary("one", "Réservation", "Deux places QA", "Aujourd’hui", true, "QA")

    @Test fun readAppearsOnlyAfterConfirmationAndDoubleTapsAreIgnored() = runBlocking {
        val gateway = Fixture().apply { gate = CompletableDeferred() }; val state = NotificationReadState("parent", gateway)
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.markRead(note) }
        assertTrue(state.display(note).unread); assertEquals("one", state.pendingId)
        state.markRead(note); state.markRead(note.copy(id = "two")); assertEquals(1, gateway.calls.size)
        gateway.gate!!.complete(Unit); request.join()
        assertFalse(state.display(note).unread); assertNull(state.pendingId)
        state.markRead(note); assertEquals(1, gateway.calls.size)
        assertEquals(listOf("parent" to "one"), gateway.calls)
    }
    @Test fun failureRemainsUnreadUntilExplicitRetryOfTheSameNotice() = runBlocking {
        val gateway = Fixture().apply { fail = true }; val state = NotificationReadState("parent", gateway)
        state.markRead(note); assertTrue(state.display(note).unread); assertNotNull(state.errors["one"])
        gateway.fail = false; state.markRead(note)
        assertFalse(state.display(note).unread); assertTrue(state.errors.isEmpty())
        assertEquals(listOf("parent" to "one", "parent" to "one"), gateway.calls)
    }
    @Test fun aFreshServerReadResolvesALostReplyWithoutAnotherWrite() = runBlocking {
        val gateway = Fixture().apply { fail = true }; val state = NotificationReadState("parent", gateway)
        state.markRead(note); state.reconcile(listOf(note.copy(unread = false)))
        state.markRead(note); assertEquals(1, gateway.calls.size)
        assertFalse(state.display(note).unread); assertTrue(state.errors.isEmpty())
    }
    @Test fun aStaleRefreshCannotRestoreUnreadAfterConfirmedAcknowledgement() = runBlocking {
        val state = NotificationReadState("parent", Fixture()); state.markRead(note); state.reconcile(listOf(note))
        assertFalse(state.display(note).unread); assertTrue(state.display(note.copy(id = "two")).unread)
    }
    @Test fun lateFailureCannotUndoAnIndependentServerConfirmation() = runBlocking {
        val gateway = Fixture().apply { gate = CompletableDeferred(); fail = true }; val state = NotificationReadState("parent", gateway)
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.markRead(note) }
        state.reconcile(listOf(note.copy(unread = false))); gateway.gate!!.complete(Unit); request.join()
        assertFalse(state.display(note).unread); assertTrue(state.errors.isEmpty())
    }
    @Test fun leavingOrSwitchingAccountDropsLateResponsesAndPrivateState() = runBlocking {
        val gateway = Fixture().apply { gate = CompletableDeferred() }; val state = NotificationReadState("parent", gateway)
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.markRead(note) }
        state.clear(); gateway.gate!!.complete(Unit); request.join()
        assertTrue(state.display(note).unread); assertNull(state.pendingId); assertTrue(state.errors.isEmpty())
        assertTrue(NotificationReadState("other", gateway).display(note).unread)
    }
    @Test fun cancellationIsPropagatedWithoutAnInventedReadOrError() = runBlocking {
        val gateway = Fixture().apply { gate = CompletableDeferred() }; val state = NotificationReadState("parent", gateway)
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.markRead(note) }
        request.cancelAndJoin(); assertTrue(state.display(note).unread); assertTrue(state.errors.isEmpty()); assertNull(state.pendingId)
    }
    @Test fun alreadyReadNoticesDoNotWrite() = runBlocking {
        val gateway = Fixture(); NotificationReadState("parent", gateway).markRead(note.copy(unread = false))
        assertTrue(gateway.calls.isEmpty())
    }
    private class Fixture : NotificationReadGateway {
        val calls = mutableListOf<Pair<String, String>>(); var gate: CompletableDeferred<Unit>? = null; var fail = false
        override suspend fun markNotificationRead(uid: String, notificationId: String) {
            calls += uid to notificationId; gate?.await(); check(!fail) { "Synthetic response loss" }
        }
    }
}
