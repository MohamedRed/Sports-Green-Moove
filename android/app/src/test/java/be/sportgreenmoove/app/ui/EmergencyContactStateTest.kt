package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.EmergencyContactGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class EmergencyContactStateTest {
    @Test fun absenceIsExplicitButReadFailureNeverLooksLikeAnEmptyContact() = runBlocking {
        val gateway = ContactFixture(); val state = ready(gateway)
        assertNotNull(state.view); assertNull(state.view?.contact); assertFalse(state.canDial)
        gateway.failRead = true; state.refresh()
        assertNull(state.view); assertNotNull(state.error); assertEquals("", state.phone)
    }
    @Test fun onlyTheReadRevisionAndValidatedTrimmedContactAreSaved() = runBlocking {
        val gateway = ContactFixture(); val state = ready(gateway)
        state.editName(" Contact QA "); state.editPhone(contact.phone); state.save()
        assertEquals(contact, gateway.writes.single().contact); assertEquals(0L, gateway.writes.single().expectedRevision)
        assertEquals(contact, state.view?.contact); assertEquals(1L, state.view?.revision); assertFalse(state.canSave)
    }
    @Test fun invalidAndLocalNumbersCannotBeSavedOrDialed() = runBlocking {
        val gateway = ContactFixture(); val state = ready(gateway); state.editName("Contact QA")
        for (phone in listOf("112", "0470000000", "+12025550123;1", "+0123456789")) {
            state.editPhone(phone); assertFalse(state.canSave); state.save(); state.dial { error("Must not dial") }
        }
        assertTrue(gateway.writes.isEmpty()); assertNull(state.view?.contact)
    }
    @Test fun aSimultaneousSecondSaveCannotRepeatTheOperation() = runBlocking {
        val gateway = ContactFixture().apply { holdWrite = CompletableDeferred() }; val state = ready(gateway); edit(state)
        val saving = launch(start = CoroutineStart.UNDISPATCHED) { state.save() }
        state.save(); state.refresh(); assertEquals(1, gateway.writes.size)
        gateway.holdWrite!!.complete(Unit); saving.join(); assertEquals(1L, state.view?.revision)
    }
    @Test fun aLostReplyClearsTheContactAndRequiresAnExplicitReadWithoutAnotherSave() = runBlocking {
        val gateway = ContactFixture().apply { loseReply = true }; val state = ready(gateway); edit(state); state.save()
        assertNull(state.view); assertEquals("", state.name); assertEquals("", state.phone)
        assertTrue(requireNotNull(state.error).contains("non confirmée")); assertFalse(state.canSave)
        state.save(); assertEquals(1, gateway.writes.size); state.refresh()
        assertEquals(contact, state.view?.contact); assertEquals(1, gateway.writes.size)
    }
    @Test fun anAcknowledgedSaveWithFailedReadIsNotReportedAsUnsent() = runBlocking {
        val gateway = ContactFixture().apply { failReadAfterWrite = true }; val state = ready(gateway); edit(state); state.save()
        assertNull(state.view); assertTrue(requireNotNull(state.error).startsWith("Modification enregistrée."))
        assertEquals("", state.phone); assertEquals(1, gateway.writes.size)
    }
    @Test fun removalUsesTheExactDisplayedViewAndRetainsItsNewRevision() = runBlocking {
        val gateway = ContactFixture().apply { current = current.copy(contact = contact, revision = 4) }; val state = ready(gateway)
        val view = requireNotNull(state.view); state.remove(view.copy()); assertTrue(gateway.writes.isEmpty())
        state.remove(view); assertNull(state.view?.contact); assertEquals(5L, state.view?.revision)
        state.remove(view); assertEquals(1, gateway.writes.size); assertFalse(state.canDial)
    }
    @Test fun aRevokedChildReadClearsPreviouslyVisiblePrivateDetails() = runBlocking {
        val target = EmergencyContactTarget.Child("child", "club")
        val gateway = ContactFixture().apply { current = EmergencyContactView("parent", target, contact, 2, "Enfant QA", "Club QA") }
        val state = EmergencyContactState("parent", gateway, target); state.refresh()
        gateway.failRead = true; state.refresh(); assertNull(state.view)
        assertEquals("", state.phone); assertEquals("", state.name); assertNotNull(state.error)
        state.dial { error("Must not dial") }; state.save(); assertTrue(gateway.writes.isEmpty())
    }
    @Test fun closingAnAccountDiscardsLateContactDetails() = runBlocking {
        val gateway = ContactFixture().apply { heldRead = CompletableDeferred() }; val state = state(gateway)
        val reading = launch(start = CoroutineStart.UNDISPATCHED) { state.refresh() }; state.close()
        gateway.heldRead!!.complete(gateway.current.copy(contact = contact, revision = 1)); reading.join()
        assertNull(state.view); assertEquals("", state.name); assertEquals("", state.phone)
    }
    @Test fun leavingTheForegroundClearsDetailsAndResumingNeedsAFreshRead() = runBlocking {
        val gateway = ContactFixture().apply { current = current.copy(contact = contact, revision = 1) }; val state = ready(gateway)
        state.leaveForeground(); assertNull(state.view); assertEquals("", state.phone)
        state.refresh(); assertEquals(contact, state.view?.contact); assertEquals(2, gateway.reads)
    }
    @Test fun dialingReadsAgainAndOpensOnlyTheUnchangedSavedContact() = runBlocking {
        val gateway = ContactFixture().apply { current = current.copy(contact = contact, revision = 1) }; val state = ready(gateway)
        var opened: PersonalEmergencyContact? = null
        state.dial { opened = it; EmergencyDialerResult.Opened }
        assertEquals(contact, opened); assertEquals(2, gateway.reads); assertTrue(gateway.writes.isEmpty())
        assertEquals("Téléphone ouvert.", state.notice)
    }
    @Test fun aChangedNumberNeverOpensWithoutANewTap() = runBlocking {
        val gateway = ContactFixture().apply { current = current.copy(contact = contact, revision = 1) }; val state = ready(gateway)
        gateway.current = gateway.current.copy(contact = contact.copy(phone = "+12025550124"), revision = 2)
        state.dial { error("Must not open a changed destination") }
        assertEquals("+12025550124", state.phone); assertTrue(requireNotNull(state.notice).contains("a changé"))
    }
    @Test fun aMissingDialerRetainsTheContactWithoutClaimingThatACallConnected() = runBlocking {
        val gateway = ContactFixture().apply { current = current.copy(contact = contact, revision = 1) }; val state = ready(gateway)
        state.dial { EmergencyDialerResult.Unavailable }
        assertEquals(contact, state.view?.contact); assertEquals(contact.phone, state.phone)
        assertEquals("Aucune application téléphone disponible.", state.error); assertNull(state.notice)
    }
    @Test fun unsavedEditsCannotBeDialedAndFailedFreshAuthorityClearsTheNumber() = runBlocking {
        val gateway = ContactFixture().apply { current = current.copy(contact = contact, revision = 1) }; val state = ready(gateway)
        state.editPhone("+12025550124"); state.dial { error("Must not dial a draft") }; assertEquals(1, gateway.reads)
        state.refresh(); gateway.failRead = true; state.dial { error("Must not dial without authority") }
        assertNull(state.view); assertEquals("", state.phone); assertNotNull(state.error)
    }
    @Test fun anotherOwnerOrAnUnexpectedTargetCannotPopulateTheEditor() = runBlocking {
        for (unexpected in listOf(EmergencyContactView("other", EmergencyContactTarget.Self, contact, 1),
            EmergencyContactView("parent", EmergencyContactTarget.Child("child", "club"), contact, 1, "Child", "Club"))) {
            val gateway = ContactFixture().apply { current = unexpected }; val state = ready(gateway)
            assertNull(state.view); assertEquals("", state.phone); assertNotNull(state.error)
        }
    }
    @Test fun aChildTargetNeedsItsOwnCurrentIdentityAndCannotKeepThePreviousAdultsContact() = runBlocking {
        val gateway = ContactFixture().apply { current = current.copy(contact = contact, revision = 1) }; val state = ready(gateway)
        gateway.current = EmergencyContactView("parent", EmergencyContactTarget.Child("child", "club"), null, 0)
        state.select(gateway.current.target); assertNull(state.view); assertEquals("", state.phone); assertNotNull(state.error)
        gateway.current = gateway.current.copy(childName = "Enfant QA", clubName = "Club QA"); state.refresh()
        assertEquals("Enfant QA", state.view?.childName); assertNull(state.view?.contact)
    }
    @Test fun aLateLaunchResultCannotRestoreAnotherAccountsNotice() = runBlocking {
        val gateway = ContactFixture().apply { current = current.copy(contact = contact, revision = 1) }; val state = ready(gateway)
        state.dial { state.close(); EmergencyDialerResult.Opened }
        assertNull(state.notice); assertNull(state.view); assertEquals("", state.phone)
    }
    private val contact = PersonalEmergencyContact("Contact QA", "+12025550123")
    private fun state(gateway: ContactFixture) = EmergencyContactState("parent", gateway, EmergencyContactTarget.Self)
    private suspend fun ready(gateway: ContactFixture) = state(gateway).also { it.refresh() }
    private fun edit(state: EmergencyContactState) { state.editName(contact.name); state.editPhone(contact.phone) }
}

private class ContactFixture : EmergencyContactGateway {
    var current = EmergencyContactView("parent", EmergencyContactTarget.Self, null, 0)
    var reads = 0
    val writes = mutableListOf<EmergencyContactOperation>()
    var failRead = false
    var failReadAfterWrite = false
    var loseReply = false
    var holdWrite: CompletableDeferred<Unit>? = null
    var heldRead: CompletableDeferred<EmergencyContactView>? = null
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView {
        reads++; if (failRead || failReadAfterWrite && writes.isNotEmpty()) error("Local denied/unavailable fixture")
        return heldRead?.await() ?: current
    }
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt {
        check(operation.target == current.target && operation.expectedRevision == current.revision)
        writes += operation; holdWrite?.await(); current = current.copy(contact = operation.contact, revision = current.revision + 1)
        if (loseReply) error("Local lost reply fixture")
        return EmergencyContactReceipt(current.revision)
    }
}
