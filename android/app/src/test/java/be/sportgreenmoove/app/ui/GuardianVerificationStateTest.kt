package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.GuardianVerificationGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class GuardianVerificationStateTest {
    @Test fun selectionRequiresAPointReadAndOnlyItsDisplayedRevisionIsSent() = runBlocking {
        val gateway = ParentGuardianFixture(); val state = ready(gateway)
        assertNull(state.view); assertTrue(state.canReview)
        state.reviewSelection(); val displayed = requireNotNull(state.view)
        assertNull(displayed.status); state.submit(displayed, GuardianParentAction.Request)
        assertEquals(0L, gateway.writes.single().expectedRevision)
        assertEquals("parent", gateway.writes.single().parentUserId)
        assertEquals(GuardianVerificationStatus.Requested, state.view?.status)
        assertNotEquals(GuardianVerificationStatus.Verified, state.view?.status)
    }
    @Test fun simultaneousConfirmationAndRefreshCannotDuplicateAWrite() = runBlocking {
        val gate = CompletableDeferred<Unit>(); val gateway = ParentGuardianFixture().apply { holdWrite = gate }
        val state = ready(gateway); state.reviewSelection(); val displayed = requireNotNull(state.view)
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.submit(displayed, GuardianParentAction.Request) }
        state.submit(displayed, GuardianParentAction.Request); state.refresh(); assertEquals(1, gateway.writes.size)
        gate.complete(Unit); first.join(); assertEquals(GuardianVerificationStatus.Requested, state.view?.status)
    }
    @Test fun lostReplyNeedsReadOnlyRecoveryAndDoesNotRepeatTheSubmission() = runBlocking {
        val gateway = ParentGuardianFixture().apply { loseReply = true }; val state = ready(gateway)
        state.reviewSelection(); val displayed = requireNotNull(state.view)
        state.submit(displayed, GuardianParentAction.Request)
        assertNull(state.view); assertNull(state.notice); assertTrue(requireNotNull(state.error).contains("non confirmée"))
        state.submit(displayed, GuardianParentAction.Request); assertEquals(1, gateway.writes.size)
        state.refresh(); assertEquals(GuardianVerificationStatus.Requested, state.view?.status); assertEquals(1, gateway.writes.size)
    }
    @Test fun acknowledgedWriteIsNotCalledUnsentWhenItsReadFails() = runBlocking {
        val gateway = ParentGuardianFixture(); val state = ready(gateway); state.reviewSelection()
        gateway.failReadAfterWrite = true; state.submit(requireNotNull(state.view), GuardianParentAction.Request)
        assertNull(state.view); assertEquals("Demande enregistrée.", state.notice)
        assertTrue(requireNotNull(state.error).startsWith("Demande enregistrée."))
    }
    @Test fun aChangedSelectionAndAnOldViewCannotSendAnotherChildsRequest() = runBlocking {
        val gateway = ParentGuardianFixture(); val state = ready(gateway); state.reviewSelection()
        val old = requireNotNull(state.view); state.selectChild("child")
        state.submit(old, GuardianParentAction.Request); assertTrue(gateway.writes.isEmpty())
        state.reviewSelection(); state.submit(requireNotNull(state.view).copy(), GuardianParentAction.Request)
        assertTrue(gateway.writes.isEmpty())
    }
    @Test fun closingAnAccountClearsAllListsAndDiscardsLateResults() = runBlocking {
        val gate = CompletableDeferred<GuardianVerification>(); val gateway = ParentGuardianFixture().apply { heldRead = gate }
        val state = ready(gateway); val pending = launch(start = CoroutineStart.UNDISPATCHED) { state.reviewSelection() }
        state.close(); gate.complete(gateway.current); pending.join()
        assertNull(state.view); assertNull(state.childId); assertTrue(state.history.items.isEmpty()); assertTrue(state.children.items.isEmpty())
    }
    @Test fun historyOpensItsActualRevisionEvenWhenNotInTheFirstChoicePage() = runBlocking {
        val gateway = ParentGuardianFixture().apply { current = current.copy(status = GuardianVerificationStatus.Revoked, revision = 7,
            allowedActions = listOf(GuardianParentAction.Request)) }
        val state = ready(gateway); state.reviewHistory(state.history.items.single())
        assertEquals(7L, state.view?.revision); state.submit(requireNotNull(state.view), GuardianParentAction.Request)
        assertEquals(7L, gateway.writes.single().expectedRevision)
    }
    @Test fun verificationCanOnlyBeRemovedOrRerequestedAccordingToCurrentCapabilities() = runBlocking {
        val gateway = ParentGuardianFixture().apply { current = current.copy(status = GuardianVerificationStatus.Verified, revision = 4,
            allowedActions = listOf(GuardianParentAction.Withdraw)) }
        val state = ready(gateway); state.reviewHistory(state.history.items.single()); val view = requireNotNull(state.view)
        state.submit(view, GuardianParentAction.Request); assertTrue(gateway.writes.isEmpty())
        state.submit(view, GuardianParentAction.Withdraw); assertEquals(GuardianVerificationStatus.Withdrawn, state.view?.status)
        assertEquals(listOf(GuardianParentAction.Request), state.view?.allowedActions)
    }
    @Test fun missingIdentityCannotBeNewlyVerifiedThroughARequest() = runBlocking {
        val gateway = ParentGuardianFixture().apply { current = current.copy(childName = null) }
        val state = ready(gateway); state.reviewSelection(); state.submit(requireNotNull(state.view), GuardianParentAction.Request)
        assertTrue(gateway.writes.isEmpty())
    }
    private suspend fun ready(gateway: ParentGuardianFixture): GuardianVerificationState =
        GuardianVerificationState("parent", gateway).also { it.load(); it.selectChild("child"); it.selectClub("club") }
}

internal class ParentGuardianFixture : GuardianVerificationGateway {
    var current = GuardianVerification("a".repeat(64), "club", "child", "parent", "Club QA", "Enfant QA", null, 0,
        listOf(GuardianParentAction.Request))
    val writes = mutableListOf<GuardianParentOperation>()
    var holdWrite: CompletableDeferred<Unit>? = null
    var heldRead: CompletableDeferred<GuardianVerification>? = null
    var loseReply = false
    var failReadAfterWrite = false
    override suspend fun guardianOptions(uid: String, kind: GuardianOptionKind, cursor: String?) =
        GuardianPage(listOf(if (kind == GuardianOptionKind.Children) GuardianOption("child", "Enfant QA") else GuardianOption("club", "Club QA")), null)
    override suspend fun guardianHistory(uid: String, cursor: String?) = GuardianPage(if (current.status == null) emptyList() else listOf(current), null)
    override suspend fun guardianView(uid: String, clubId: String, childId: String): GuardianVerification {
        if (failReadAfterWrite && writes.isNotEmpty()) error("offline")
        return heldRead?.await() ?: current
    }
    override suspend fun transitionGuardian(request: GuardianParentOperation): GuardianTransitionReceipt {
        writes += request; holdWrite?.await()
        current = current.copy(status = if (request.action == GuardianParentAction.Request) GuardianVerificationStatus.Requested else GuardianVerificationStatus.Withdrawn,
            revision = request.expectedRevision + 1, allowedActions = listOf(if (request.action == GuardianParentAction.Request) GuardianParentAction.Withdraw else GuardianParentAction.Request))
        if (loseReply) error("lost reply")
        return GuardianTransitionReceipt(current.id, requireNotNull(current.status), current.revision)
    }
}
