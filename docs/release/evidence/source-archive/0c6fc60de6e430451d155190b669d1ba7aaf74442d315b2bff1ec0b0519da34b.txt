package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TeamEnrollmentGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class TeamEnrollmentHistoryStateTest {
    @Test fun ownedHistoryDoesNotNeedActiveClubChoicesAndLoadingNeverWrites() = runBlocking {
        val gateway = HistoryFixture(); val state = ready(gateway)
        assertEquals(20, state.requests.items.size); assertTrue(state.requests.hasMore); assertTrue(gateway.writes.isEmpty())
        state.more(); assertEquals(25, state.requests.items.size); assertFalse(state.requests.hasMore)
        state.select(gateway.first.id); assertFalse(requireNotNull(state.selected).eligible); assertTrue(gateway.writes.isEmpty())
    }
    @Test fun confirmationUsesOnlyTheExactFreshlyReadObjectAndWithdrawsOnce() = runBlocking {
        val gateway = HistoryFixture(); val state = ready(gateway); state.select(gateway.first.id)
        val selected = requireNotNull(state.selected)
        state.withdraw(selected.copy()); assertTrue(gateway.writes.isEmpty())
        state.withdraw(selected); assertEquals(1, gateway.writes.size)
        assertEquals(TeamEnrollmentStatus.Withdrawn, state.selected?.status); assertEquals("Retrait enregistré.", state.notice)
    }
    @Test fun simultaneousConfirmationsAndPaginationCannotDuplicateAWrite() = runBlocking {
        val gateway = HistoryFixture().apply { holdWrite = CompletableDeferred() }; val state = ready(gateway)
        state.select(gateway.first.id); val selected = requireNotNull(state.selected)
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.withdraw(selected) }
        state.withdraw(selected); state.more(); assertEquals(1, gateway.writes.size); assertEquals(20, state.requests.items.size)
        gateway.holdWrite!!.complete(Unit); first.join(); assertEquals(TeamEnrollmentStatus.Withdrawn, state.selected?.status)
    }
    @Test fun aLostReplyNeverResubmitsAndOnlyAnExplicitReadRevealsTheCommittedWithdrawal() = runBlocking {
        val gateway = HistoryFixture().apply { loseReply = true }; val state = ready(gateway)
        state.select(gateway.first.id); val selected = requireNotNull(state.selected); state.withdraw(selected)
        assertNull(state.selected); assertNull(state.notice); assertTrue(requireNotNull(state.error).contains("non confirmé"))
        state.withdraw(selected); assertEquals(1, gateway.writes.size)
        state.select(gateway.first.id); assertEquals(TeamEnrollmentStatus.Withdrawn, state.selected?.status); assertEquals(1, gateway.writes.size)
    }
    @Test fun anAcknowledgedWithdrawalIsNotReportedAsUnsentWhenItsReadbackFails() = runBlocking {
        val gateway = HistoryFixture().apply { failAfterWrite = true }; val state = ready(gateway)
        state.select(gateway.first.id); state.withdraw(requireNotNull(state.selected))
        assertNull(state.selected); assertEquals("Retrait enregistré.", state.notice)
        assertTrue(requireNotNull(state.error).contains("enregistré"))
    }
    @Test fun revokedOrChangedIdentityCannotRetainAnOldAction() = runBlocking {
        val gateway = HistoryFixture(); val state = ready(gateway); state.select(gateway.first.id)
        val old = requireNotNull(state.selected); gateway.foreignRead = true; state.select(old.id)
        assertNull(state.selected); assertNotNull(state.error); state.withdraw(old); assertTrue(gateway.writes.isEmpty())
    }
    @Test fun missingCapabilitiesNeverProduceAWrite() = runBlocking {
        val gateway = HistoryFixture().apply { rows[0] = rows[0].copy(childId = "child", subjectId = "child", allowedActions = emptyList()) }
        val state = ready(gateway); state.select(gateway.first.id); state.withdraw(requireNotNull(state.selected))
        assertTrue(gateway.writes.isEmpty())
    }
    @Test fun backgroundingAndAccountReplacementClearPrivateRowsAndIgnoreLateReplies() = runBlocking {
        val gateway = HistoryFixture().apply { heldRead = CompletableDeferred() }; val state = ready(gateway)
        val pending = launch(start = CoroutineStart.UNDISPATCHED) { state.select(gateway.first.id) }
        state.clear(); gateway.heldRead!!.complete(gateway.first); pending.join()
        assertNull(state.selected); assertTrue(state.requests.items.isEmpty())
        state.close(); state.refresh(); assertTrue(state.requests.items.isEmpty())
        val next = TeamEnrollmentHistoryState("other", HistoryFixture("other")); next.refresh()
        assertTrue(next.requests.items.all { it.subjectId == "other" })
    }
    @Test fun failedRefreshClearsVisibleRowsAndDoesNotRetainAnOldConfirmation() = runBlocking {
        val gateway = HistoryFixture(); val state = ready(gateway); state.select(gateway.first.id)
        gateway.denyList = true; state.refresh()
        assertNull(state.selected); assertTrue(state.requests.items.isEmpty()); assertNotNull(state.requests.error)
    }
    private suspend fun ready(gateway: HistoryFixture) = TeamEnrollmentHistoryState("parent", gateway).also { it.refresh() }
}

private class HistoryFixture(private val owner: String = "parent") : TeamEnrollmentGateway {
    val rows = (1..25).map { index -> TeamEnrollmentView(index.toString(16).padStart(64, '0'), "team-$index", "club",
        "b".repeat(64), "Équipe QA $index", owner, null, null, TeamEnrollmentStatus.Approved, 4, false,
        listOf(TeamEnrollmentAction.Withdraw)) }.toMutableList()
    val first get() = rows.first()
    val writes = mutableListOf<String>()
    var holdWrite: CompletableDeferred<Unit>? = null
    var heldRead: CompletableDeferred<TeamEnrollmentView>? = null
    var loseReply = false; var failAfterWrite = false; var foreignRead = false; var denyList = false
    override suspend fun ownedTeamEnrollments(uid: String, cursor: String?): GuardianPage<TeamEnrollmentView> {
        check(uid == owner && !denyList)
        return if (cursor == null) GuardianPage(rows.take(20), "next") else GuardianPage(rows.drop(20), null)
    }
    override suspend fun ownedTeamEnrollmentView(uid: String, enrollmentId: String): TeamEnrollmentView {
        check(uid == owner && !(failAfterWrite && writes.isNotEmpty()))
        return heldRead?.await() ?: rows.single { it.id == enrollmentId }.let { if (foreignRead) it.copy(teamId = "foreign") else it }
    }
    override suspend fun withdrawOwnedTeamEnrollment(uid: String, expected: TeamEnrollmentView, requestId: String): TeamEnrollmentReceipt {
        check(uid == owner); writes += requestId; holdWrite?.await()
        val index = rows.indexOfFirst { it.id == expected.id }; check(rows[index].revision == expected.revision)
        rows[index] = expected.copy(status = TeamEnrollmentStatus.Withdrawn, revision = expected.revision + 1, allowedActions = emptyList())
        if (loseReply) error("reply lost")
        return TeamEnrollmentReceipt(expected.id, expected.teamId, expected.teamInstanceId, TeamEnrollmentStatus.Withdrawn, expected.revision + 1)
    }
    override suspend fun teamOptions(uid: String, kind: TeamEnrollmentOptionKind, contextId: String?, cursor: String?): GuardianPage<GuardianOption> = error("No current club access")
    override suspend fun teamEnrollmentView(uid: String, teamId: String, childId: String?): TeamEnrollmentView = error("No current club access")
    override suspend fun changeTeamEnrollment(uid: String, expected: TeamEnrollmentView, action: TeamEnrollmentAction, requestId: String): TeamEnrollmentReceipt = error("Not the owned-history path")
}
