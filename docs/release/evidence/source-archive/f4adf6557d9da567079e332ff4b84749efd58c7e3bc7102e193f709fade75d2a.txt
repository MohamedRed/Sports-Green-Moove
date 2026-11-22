package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.EmergencyContactGateway
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChildRideEmergencyStateTest {
    private val contact = PersonalEmergencyContact("Contact enfant QA", "+12025550121")
    private fun fixture() = ChildReadFixture(ChildRideEmergencyContactView("child", "ride", "profile-child", "a".repeat(64), "Enfant QA", contact, 1))
    @Test fun discoversTheChildContactWithoutAnAdultRideAndRechecksThatRideBeforeDialing() = runBlocking {
        val gateway = fixture(); val state = ChildRideEmergencyState("child", null, gateway)
        state.refresh(); assertEquals("profile-child", state.view?.childId); assertEquals(1, gateway.discoveries)
        state.dial { EmergencyDialerResult.Opened }; assertEquals(1, gateway.reads)
        assertEquals("ride", gateway.lastRideId); assertEquals(0, gateway.writes)
    }
    @Test fun noRideAndDeniedDiscoveryAreDistinctAndNeverRetainThePreviousNumber() = runBlocking {
        val gateway = fixture(); val state = ChildRideEmergencyState("child", null, gateway)
        state.refresh(); assertNotNull(state.view)
        gateway.noRide = true; state.refresh(); assertTrue(state.noActiveRide); assertNull(state.error); assertNull(state.view)
        gateway.fail = true; state.refresh(); assertFalse(state.noActiveRide); assertNotNull(state.error); assertFalse(state.canDial)
    }
    @Test fun discoveryReplyAfterLeavingTheScreenCannotRestorePrivateData() = runTest {
        val gateway = fixture(); gateway.held = CompletableDeferred()
        val state = ChildRideEmergencyState("child", null, gateway)
        val pending = launch { state.refresh() }; runCurrent(); state.close()
        gateway.held!!.complete(gateway.current); pending.join()
        assertNull(state.view); assertFalse(state.noActiveRide); assertFalse(state.canDial)
    }
    @Test fun emptyIsExplicitButAReadFailureClearsThePrivateContactAndNeverLooksEmpty() = runBlocking {
        val gateway = fixture(); val state = ChildRideEmergencyState("child", "ride", gateway)
        gateway.current = gateway.current.copy(contact = null, revision = 0); state.refresh()
        assertNotNull(state.view); assertFalse(state.canDial)
        gateway.fail = true; state.refresh(); assertNull(state.view); assertNotNull(state.error)
    }
    @Test fun onlyAFreshMatchingContactCanOpenThePhoneAndNoWriteCapabilityIsUsed() = runBlocking {
        val gateway = fixture(); val state = ChildRideEmergencyState("child", "ride", gateway); state.refresh()
        var opened = 0; state.dial { assertEquals(contact, it); opened++; EmergencyDialerResult.Opened }
        assertEquals(1, opened); assertEquals(2, gateway.reads); assertEquals(0, gateway.writes)
    }
    @Test fun aChangedNumberOrChildIdentityRequiresAnotherExplicitTap() = runBlocking {
        for (change in listOf<(ChildRideEmergencyContactView) -> ChildRideEmergencyContactView>(
            { it.copy(contact = PersonalEmergencyContact("Autre QA", "+12025550122"), revision = 2) },
            { it.copy(childInstanceId = "b".repeat(64)) }, { it.copy(childId = "other-profile") })) {
            val gateway = fixture(); val state = ChildRideEmergencyState("child", "ride", gateway); state.refresh()
            gateway.current = change(gateway.current)
            state.dial { error("A changed destination must not open") }; assertNotNull(state.notice)
            var opened = false; state.dial { opened = true; EmergencyDialerResult.Opened }; assertTrue(opened)
        }
    }
    @Test fun removalOrRevokedAuthorityCannotOpenThePreviouslyDisplayedNumber() = runBlocking {
        val gateway = fixture(); val state = ChildRideEmergencyState("child", "ride", gateway); state.refresh()
        gateway.current = gateway.current.copy(contact = null, revision = 2)
        state.dial { error("A removed contact must not open") }; assertFalse(state.canDial)
        gateway.current = fixture().current; state.refresh(); gateway.fail = true
        state.dial { error("Revoked contact must not open") }; assertNull(state.view); assertNotNull(state.error)
    }
    @Test fun otherAccountsOtherRidesAndUnsafeRepliesCannotPopulateTheScreen() = runBlocking {
        for (change in listOf<(ChildRideEmergencyContactView) -> ChildRideEmergencyContactView>(
            { it.copy(ownerUid = "other") }, { it.copy(childId = "") }, { it.copy(childId = "a/b") }, { it.copy(rideSessionId = "other") },
            { it.copy(childInstanceId = "unknown") }, { it.copy(revision = -1) }, { it.copy(revision = 0) })) {
            val gateway = fixture(); gateway.current = change(gateway.current)
            val state = ChildRideEmergencyState("child", "ride", gateway); state.refresh()
            assertNull(state.view); assertFalse(state.canDial); assertNotNull(state.error)
        }
    }
    @Test fun backgroundAndAccountDisposalInvalidateAnOutstandingRead() = runTest {
        for (close in listOf(false, true)) {
            val gateway = fixture(); gateway.held = CompletableDeferred()
            val state = ChildRideEmergencyState("child", "ride", gateway)
            val reading = launch { state.refresh() }; runCurrent()
            if (close) state.close() else state.leaveForeground()
            gateway.held!!.complete(gateway.current); reading.join()
            assertNull(state.view); assertFalse(state.canDial); assertFalse(state.busy)
        }
    }
    @Test fun backgroundDuringFreshDialReadPreventsTheHandoff() = runTest {
        val gateway = fixture(); val state = ChildRideEmergencyState("child", "ride", gateway); state.refresh()
        gateway.held = CompletableDeferred(); val pending = launch { state.dial { error("Background handoff refused") } }
        runCurrent(); state.leaveForeground(); gateway.held!!.complete(gateway.current); pending.join(); assertNull(state.view)
    }
    @Test fun missingOrDeniedPhoneAppsKeepTheVerifiedDestinationWithoutInventingAnAlternative() = runBlocking {
        for (result in listOf(EmergencyDialerResult.Unavailable, EmergencyDialerResult.Denied)) {
            val gateway = fixture(); val state = ChildRideEmergencyState("child", "ride", gateway); state.refresh()
            state.dial { result }; assertEquals(contact, state.view?.contact); assertNotNull(state.error)
        }
    }
}
private class ChildReadFixture(var current: ChildRideEmergencyContactView) : EmergencyContactGateway {
    var discoveries = 0; var noRide = false; var lastRideId: String? = null
    override suspend fun discoverChildRideEmergencyContact(uid: String): ChildRideEmergencyContactView? {
        discoveries++; if (fail) error("Explicit denied discovery")
        return if (noRide) null else held?.await() ?: current
    }
    var reads = 0; var writes = 0; var fail = false
    var held: CompletableDeferred<ChildRideEmergencyContactView>? = null
    override suspend fun readChildRideEmergencyContact(uid: String, rideSessionId: String): ChildRideEmergencyContactView {
        reads++; lastRideId = rideSessionId; if (fail) error("Explicit denied read"); return held?.await() ?: current
    }
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView = error("Not an adult read")
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt {
        writes++; error("Children cannot write contacts")
    }
}
