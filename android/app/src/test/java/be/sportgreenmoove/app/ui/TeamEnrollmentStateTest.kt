package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TeamEnrollmentGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class TeamEnrollmentStateTest {
    @Test fun choicesNeverSubmitBeforeAnExactCurrentReviewAndConfirmation() = runBlocking {
        val gateway = TeamEnrollmentFixture(); val state = ready(gateway)
        assertNull(state.view); assertTrue(state.canReview); assertTrue(gateway.writes.isEmpty())
        state.review(); val expected = requireNotNull(state.view)
        state.submit(expected.copy(), TeamEnrollmentAction.Request); assertTrue(gateway.writes.isEmpty())
        state.submit(expected, TeamEnrollmentAction.Request)
        assertEquals(1, gateway.writes.size); assertEquals(0L, gateway.writes.single().second.revision)
        assertEquals(TeamEnrollmentStatus.Requested, state.view?.status); assertNotEquals(TeamEnrollmentStatus.Approved, state.view?.status)
    }
    @Test fun subjectChangesCannotReuseAnotherPersonsDisplayedRequest() = runBlocking {
        val gateway = TeamEnrollmentFixture(); val state = ready(gateway); state.review(); val old = requireNotNull(state.view)
        state.chooseChildMode(true); assertFalse(state.canReview)
        state.submit(old, TeamEnrollmentAction.Request); assertTrue(gateway.writes.isEmpty())
        state.chooseChild("child"); state.review(); state.submit(requireNotNull(state.view), TeamEnrollmentAction.Request)
        assertEquals("child", gateway.writes.single().second.childId)
    }
    @Test fun aNonParentCannotChooseOrAccidentallyRequestForAChild() = runBlocking {
        assertFalse(canManageTeamEnrollment(setOf(AppRole.Child, AppRole.Parent, AppRole.ClubManager)))
        assertFalse(canManageTeamEnrollment(setOf(AppRole.Admin)))
        assertTrue(canManageTeamEnrollment(setOf(AppRole.Driver)))
        val gateway = TeamEnrollmentFixture(); val state = ready(gateway, false)
        state.chooseChildMode(true); state.chooseChild("child")
        assertFalse(state.childMode); assertNull(state.childId)
        state.review(); assertNull(state.view?.childId)
    }
    @Test fun concurrentConfirmationsAndRefreshDoNotDuplicateTheWrite() = runBlocking {
        val gateway = TeamEnrollmentFixture().apply { holdWrite = CompletableDeferred() }; val state = ready(gateway)
        state.review(); val displayed = requireNotNull(state.view)
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.submit(displayed, TeamEnrollmentAction.Request) }
        state.submit(displayed, TeamEnrollmentAction.Request); state.refresh(); assertEquals(1, gateway.writes.size)
        gateway.holdWrite!!.complete(Unit); first.join(); assertEquals(TeamEnrollmentStatus.Requested, state.view?.status)
    }
    @Test fun aLostReplyClearsActionsAndRequiresAnExplicitReadNotAnotherWrite() = runBlocking {
        val gateway = TeamEnrollmentFixture().apply { loseReply = true }; val state = ready(gateway)
        state.review(); val displayed = requireNotNull(state.view); state.submit(displayed, TeamEnrollmentAction.Request)
        assertNull(state.view); assertNull(state.notice); assertTrue(requireNotNull(state.error).contains("non confirmée"))
        state.submit(displayed, TeamEnrollmentAction.Request); assertEquals(1, gateway.writes.size)
        state.review(); assertEquals(TeamEnrollmentStatus.Requested, state.view?.status); assertEquals(1, gateway.writes.size)
    }
    @Test fun acknowledgedWritesKeepTheirReceiptWhenTheLaterReadFails() = runBlocking {
        val gateway = TeamEnrollmentFixture().apply { failAfterWrite = true }; val state = ready(gateway)
        state.review(); state.submit(requireNotNull(state.view), TeamEnrollmentAction.Request)
        assertNull(state.view); assertEquals("Demande enregistrée.", state.notice)
        assertTrue(requireNotNull(state.error).contains("enregistrée"))
    }
    @Test fun staleOrRevokedReadRepliesCannotKeepAnOldAction() = runBlocking {
        val gateway = TeamEnrollmentFixture(); val state = ready(gateway); state.review(); val old = requireNotNull(state.view)
        gateway.denyRead = true; state.review(); assertNull(state.view)
        state.submit(old, TeamEnrollmentAction.Request); assertTrue(gateway.writes.isEmpty())
    }
    @Test fun backgroundingAndClosingDiscardNamesSelectionsAndLateResponses() = runBlocking {
        val gateway = TeamEnrollmentFixture().apply { heldRead = CompletableDeferred() }; val state = ready(gateway)
        val read = launch(start = CoroutineStart.UNDISPATCHED) { state.review() }
        state.clear(); gateway.heldRead!!.complete(gateway.current); read.join()
        assertNull(state.view); assertNull(state.clubId); assertNull(state.childId); assertTrue(state.clubs.items.isEmpty())
        state.close(); state.refresh(); assertFalse(state.canReview)
    }
    @Test fun changingClubClearsAllTeamAndChildContext() = runBlocking {
        val state = ready(TeamEnrollmentFixture()); state.chooseChildMode(true); state.chooseChild("child"); state.review()
        state.chooseClub("club"); assertNull(state.view); assertNull(state.teamId); assertNull(state.childId)
        assertTrue(state.children.items.isEmpty()); assertFalse(state.canReview)
    }
    @Test fun onlyAnAllowedWithdrawalIsSubmittedForTheDisplayedApprovedRevision() = runBlocking {
        val gateway = TeamEnrollmentFixture().apply { current = current.copy(status = TeamEnrollmentStatus.Approved, revision = 4,
            allowedActions = listOf(TeamEnrollmentAction.Withdraw)) }
        val state = ready(gateway); state.review(); val expected = requireNotNull(state.view)
        state.submit(expected, TeamEnrollmentAction.Request); assertTrue(gateway.writes.isEmpty())
        state.submit(expected, TeamEnrollmentAction.Withdraw); assertEquals(4L, gateway.writes.single().second.revision)
        assertEquals(TeamEnrollmentStatus.Withdrawn, state.view?.status)
    }
    @Test fun missingNamesNeverBecomeAnInventedRequestIdentity() = runBlocking {
        val gateway = TeamEnrollmentFixture().apply { current = current.copy(subjectName = null) }; val state = ready(gateway)
        state.review(); state.submit(requireNotNull(state.view), TeamEnrollmentAction.Request); assertTrue(gateway.writes.isEmpty())
    }
    @Test fun aForeignOrRecreatedTeamReadDoesNotReplaceTheConfirmedRequest() = runBlocking {
        val gateway = TeamEnrollmentFixture(); val state = ready(gateway); state.review()
        gateway.current = gateway.current.copy(clubId = "other-club"); state.review(); assertNull(state.view); assertNotNull(state.error)
    }
    private suspend fun ready(gateway: TeamEnrollmentFixture, parent: Boolean = true) = TeamEnrollmentState("parent", gateway, parent).also {
        it.refresh(); it.chooseClub("club"); it.chooseTeam("team")
    }
}

internal class TeamEnrollmentFixture : TeamEnrollmentGateway {
    override suspend fun ownedTeamEnrollments(uid: String, cursor: String?): GuardianPage<TeamEnrollmentView> = error("History is not part of this request fixture")
    override suspend fun ownedTeamEnrollmentView(uid: String, enrollmentId: String): TeamEnrollmentView = error("History is not part of this request fixture")
    override suspend fun withdrawOwnedTeamEnrollment(uid: String, expected: TeamEnrollmentView, requestId: String): TeamEnrollmentReceipt = error("History is not part of this request fixture")
    var current = TeamEnrollmentView("a".repeat(64), "team", "club", "b".repeat(64), "Equipe QA", "parent", null,
        "Parent QA", null, 0, true, listOf(TeamEnrollmentAction.Request))
    val writes = mutableListOf<Triple<String, TeamEnrollmentView, TeamEnrollmentAction>>()
    var holdWrite: CompletableDeferred<Unit>? = null
    var heldRead: CompletableDeferred<TeamEnrollmentView>? = null
    var loseReply = false; var failAfterWrite = false; var denyRead = false
    override suspend fun teamOptions(uid: String, kind: TeamEnrollmentOptionKind, contextId: String?, cursor: String?) = GuardianPage(
        listOf(when (kind) { TeamEnrollmentOptionKind.Clubs -> GuardianOption("club", "Club QA")
            TeamEnrollmentOptionKind.Teams -> GuardianOption("team", "Equipe QA"); TeamEnrollmentOptionKind.Children -> GuardianOption("child", "Enfant QA") }), null)
    override suspend fun teamEnrollmentView(uid: String, teamId: String, childId: String?): TeamEnrollmentView {
        if (denyRead || failAfterWrite && writes.isNotEmpty()) error("read denied")
        return heldRead?.await() ?: current.copy(childId = childId, subjectId = childId ?: uid)
    }
    override suspend fun changeTeamEnrollment(uid: String, expected: TeamEnrollmentView, action: TeamEnrollmentAction, requestId: String): TeamEnrollmentReceipt {
        writes += Triple(uid, expected, action); holdWrite?.await()
        current = expected.copy(status = if (action == TeamEnrollmentAction.Request) TeamEnrollmentStatus.Requested else TeamEnrollmentStatus.Withdrawn,
            revision = expected.revision + 1, allowedActions = listOf(if (action == TeamEnrollmentAction.Request) TeamEnrollmentAction.Withdraw else TeamEnrollmentAction.Request))
        if (loseReply) error("lost reply")
        return TeamEnrollmentReceipt(current.id, current.teamId, current.teamInstanceId, requireNotNull(current.status), current.revision)
    }
}
