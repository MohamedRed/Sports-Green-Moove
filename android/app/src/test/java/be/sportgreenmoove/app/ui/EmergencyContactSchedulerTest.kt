package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.EmergencyContactGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import kotlin.concurrent.thread

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class EmergencyContactSchedulerTest {
    private val contact = PersonalEmergencyContact("Contact QA", "+12025550123")
    private val initial = EmergencyContactView("parent", EmergencyContactTarget.Self, contact, 1)

    @Test fun callbackCompletionDoesNotRunTheQueuedDialContinuationWithoutSchedulerProgress() = runTest {
        val fixture = CallbackContactFixture(initial)
        val state = EmergencyContactState("parent", fixture, EmergencyContactTarget.Self)
        state.refresh()
        val reply = CompletableDeferred<EmergencyContactView>(); fixture.reply = reply
        var opened = false
        val attempt = launch { state.dial { opened = true; EmergencyDialerResult.Opened } }
        runCurrent(); assertTrue(state.busy); assertFalse(opened)
        thread { reply.complete(initial) }.join()
        assertTrue(reply.isCompleted); assertFalse(opened); assertFalse(attempt.isCompleted)
        runCurrent(); assertTrue(opened); assertTrue(attempt.isCompleted); assertFalse(state.busy)
    }

    @Test fun advancingQueuedWorkNeverBypassesTheFreshReadRevocationDenial() = runTest {
        val fixture = CallbackContactFixture(initial)
        val state = EmergencyContactState("parent", fixture, EmergencyContactTarget.Self)
        state.refresh()
        val reply = CompletableDeferred<EmergencyContactView>(); fixture.reply = reply
        var opened = false
        launch { state.dial { opened = true; EmergencyDialerResult.Opened } }
        runCurrent(); thread { reply.completeExceptionally(IllegalStateException("Denied fixture")) }.join()
        runCurrent(); assertFalse(opened); assertFalse(state.busy); assertNull(state.view); assertEquals("", state.phone)
        assertNotNull(state.error)
    }

    @Test fun advancingQueuedWorkNeverDialsAChangedDestinationWithoutAnotherTap() = runTest {
        val fixture = CallbackContactFixture(initial)
        val state = EmergencyContactState("parent", fixture, EmergencyContactTarget.Self)
        state.refresh()
        val reply = CompletableDeferred<EmergencyContactView>(); fixture.reply = reply
        var opened = false
        launch { state.dial { opened = true; EmergencyDialerResult.Opened } }
        runCurrent()
        val changed = initial.copy(contact = PersonalEmergencyContact("Autre contact QA", "+12025550124"), revision = 2)
        thread { reply.complete(changed) }.join(); runCurrent()
        assertFalse(opened); assertEquals(changed, state.view); assertNotNull(state.notice)
        assertEquals("+12025550124", state.phone)
    }
}

private class CallbackContactFixture(private val initial: EmergencyContactView) : EmergencyContactGateway {
    override suspend fun discoverChildRideEmergencyContact(uid: String): ChildRideEmergencyContactView? = error("Not a child fixture")
    override suspend fun readChildRideEmergencyContact(uid: String, rideSessionId: String): ChildRideEmergencyContactView =
        error("This fixture does not implement child ride reads")
    var reply: CompletableDeferred<EmergencyContactView>? = null
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget) = reply?.await() ?: initial
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt =
        error("The scheduler fixture cannot save contacts")
}
