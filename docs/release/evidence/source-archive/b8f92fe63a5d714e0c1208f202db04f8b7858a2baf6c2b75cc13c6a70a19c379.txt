package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.EmergencyContactGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class EmergencyContactSelectionTest {
    private val child = EmergencyContactTarget.Child("child", "club")

    @Test fun selectionDuringAnInitialReadIsExplicitlyRefusedWithoutChangingItsScope() = runTest {
        val fixture = SelectionFixture(); val state = EmergencyContactState("parent", fixture, EmergencyContactTarget.Self)
        val read = launch { state.refresh() }; runCurrent()
        assertTrue(state.busy); assertFalse(state.select(child)); assertEquals(EmergencyContactTarget.Self, state.target)
        fixture.firstRead.complete(Unit); runCurrent(); read.join()
        assertEquals(EmergencyContactTarget.Self, state.view?.target)
        assertTrue(state.select(child)); assertEquals(child, state.target); assertNull(state.view)
        assertEquals("", state.phone); assertFalse(state.canDial); assertEquals(1, fixture.reads)
        state.refresh(); assertEquals(child, state.view?.target); assertEquals(2, fixture.reads)
    }
    @Test fun closingTheAccountRefusesAStalePickerCallback() = runTest {
        val fixture = SelectionFixture(); val state = EmergencyContactState("parent", fixture, EmergencyContactTarget.Self)
        state.close(); assertFalse(state.select(child)); assertEquals(EmergencyContactTarget.Self, state.target)
        state.refresh(); assertEquals(0, fixture.reads); assertNull(state.view)
    }
    @Test fun aReadFailureDoesNotSilentlyRestoreThePreviouslySelectedAdult() = runTest {
        val fixture = SelectionFixture(); fixture.firstRead.complete(Unit)
        val state = EmergencyContactState("parent", fixture, EmergencyContactTarget.Self); state.refresh()
        assertTrue(state.select(child)); fixture.fail = true; state.refresh()
        assertEquals(child, state.target); assertNull(state.view); assertNotNull(state.error)
        fixture.fail = false; state.refresh(); assertEquals(child, state.view?.target)
    }
}
private class SelectionFixture : EmergencyContactGateway {
    val firstRead = CompletableDeferred<Unit>(); var reads = 0; var fail = false
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView {
        if (reads++ == 0) firstRead.await()
        check(!fail)
        return EmergencyContactView(uid, target, null, 0,
            if (target is EmergencyContactTarget.Child) "Enfant QA" else null,
            if (target is EmergencyContactTarget.Child) "Club QA" else null,
            if (target is EmergencyContactTarget.Child) "a".repeat(64) else null)
    }
    override suspend fun readChildRideEmergencyContact(uid: String, rideSessionId: String): ChildRideEmergencyContactView = error("Not a child-account fixture")
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt = error("Read-only selection fixture")
}
