package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TeamConversationTarget
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TeamPushAlertTest {
    private val id = "teamChat_" + "b".repeat(64)
    private val identity = TeamPushIdentity("11223344-1234-4234-8234-123456789abc", "a".repeat(64))
    private val target = TeamConversationTarget("team", "c".repeat(64))
    private fun response() = mapOf("status" to "available", "notificationId" to id,
        "title" to teamPushAlertTitle, "body" to teamPushAlertBody,
        "target" to mapOf("teamId" to target.teamId, "expectedTeamInstanceId" to target.teamInstanceId))
    private class Memory : TeamPushStorage {
        var value: TeamPushRecord? = null
        override fun read() = value
        override fun update(change: (TeamPushRecord?) -> TeamPushRecord) = change(value).also { value = it }
    }
    private inner class Fixture {
        val journal = TeamPushJournal(Memory()) { identity }
        var uid: String? = "parent"
        val lifecycle = TeamPushLifecycle(journal, object : TeamPushTokenSource {
            override fun setAutoInit(enabled: Boolean) = Unit
            override suspend fun token() = "synthetic_token_" + "T".repeat(80)
            override suspend fun deleteToken() = Unit
        }, { uid }, { true }, { TeamPushReceipt(it.uid, it.revision, it.token != null, false) })
        suspend fun ready(): TeamPushOpenRequest { lifecycle.synchronize(true); return requireNotNull(lifecycle.alertRequest(id)) }
    }
    @Test fun onlyGenericCopyAndTheExactOpaqueAlertCanBecomeATeamTarget() {
        assertEquals(target, parseTeamPushAlert(response(), id))
        assertNull(parseTeamPushAlert(mapOf("status" to "suppressed"), id))
        for (bad in listOf(null, emptyMap<String, Any>(), response() + ("body" to "private message"),
            response() + ("notificationId" to "teamChat_" + "d".repeat(64)), response() + ("url" to "https://invalid.test"),
            response() + ("target" to mapOf("teamId" to "team", "expectedTeamInstanceId" to "bad")),
            mapOf("status" to "suppressed", "target" to "private")))
            assertThrows(RuntimeException::class.java) { parseTeamPushAlert(bad, id) }
    }
    @Test fun malformedRequestsCannotCarryArbitraryIdentifiersOrEpochs() {
        for (bad in listOf("", "teamChat_" + "B".repeat(64), id + "\n", "../team"))
            assertThrows(IllegalArgumentException::class.java) { TeamPushOpenRequest(bad, "parent", 1) }
        for (epoch in listOf(0L, -1L, teamPushMaximumRevision + 1))
            assertThrows(IllegalArgumentException::class.java) { TeamPushOpenRequest(id, "parent", epoch) }
    }
    @Test fun proofOnlyLeavesTheJournalInTheStrictCallableRequestAndNeverInDiagnosticStrings() {
        val lease = TeamPushAlertLease(identity, "parent", 1, 2)
        assertEquals(setOf("installationId", "installationSecret", "revision", "notificationId", "purpose"), lease.payload(id, TeamPushAlertPurpose.Open).keys)
        assertEquals("open", lease.payload(id, TeamPushAlertPurpose.Open)["purpose"])
        for (text in listOf(lease.toString(), TeamPushOpenRequest(id, "parent", 1).toString()))
            for (private in listOf(identity.id, identity.proof, "parent", id)) assertFalse(text.contains(private))
    }
    @Test fun currentConfirmedDeviceResolvesAndConsumesOnlyAfterTheActualServerResult() = runTest {
        val f = Fixture(); val request = f.ready(); var effects = 0
        val hold = CompletableDeferred<Any?>()
        val job = async { f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Display, { lease, alert, purpose ->
            assertEquals(request.uid, lease.uid); assertEquals(request.epoch, lease.epoch)
            assertEquals(id, alert); assertEquals(TeamPushAlertPurpose.Display, purpose); hold.await()
        }) { assertEquals(target, it); effects++ } }
        runCurrent(); assertEquals(0, effects); hold.complete(response()); assertTrue(job.await()); assertEquals(1, effects)
    }
    @Test fun suppressedAlertHasNoEffectAndDoesNotModifyTheRegistration() = runTest {
        val f = Fixture(); val request = f.ready(); val before = f.journal.current()
        assertFalse(f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Open, { _, _, _ -> mapOf("status" to "suppressed") }) { error("Must not open") })
        assertEquals(before, f.journal.current())
    }
    @Test fun signoutWhileResolvingCannotDisplayOrOpenAnEarlierResult() = runTest {
        val f = Fixture(); val request = f.ready(); val hold = CompletableDeferred<Unit>()
        val job = async { f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Display, { _, _, _ -> hold.await(); response() }) { error("Must not display") } }
        runCurrent(); f.lifecycle.signedOut(); hold.complete(Unit)
        assertFalse(job.await())
        assertFalse(f.lifecycle.acceptsAlert(request)); assertNull(f.lifecycle.alertRequest(id))
    }
    @Test fun anotherAccountAndReturnToTheSameAccountCannotReuseAnEarlierEpoch() = runTest {
        val f = Fixture(); val request = f.ready()
        f.uid = "driver"; f.lifecycle.accountChanged(f.uid)
        assertFalse(f.lifecycle.acceptsAlert(request))
        f.uid = "parent"; f.lifecycle.authorizeSignIn("parent"); f.lifecycle.synchronize(true)
        assertFalse(f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Open, { _, _, _ -> error("Must not request") }) { error("Must not open") })
        assertTrue(requireNotNull(f.lifecycle.alertRequest(id)).epoch > request.epoch)
    }
    @Test fun tokenRefreshIsSerializedBehindResolutionAndDoesNotInvalidateTheNextTapEpoch() = runTest {
        val f = Fixture(); val request = f.ready(); val before = f.journal.current().revision
        val hold = CompletableDeferred<Unit>(); var effects = 0
        val read = async { f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Open, { _, _, _ -> hold.await(); response() }) { effects++ } }
        runCurrent(); val refresh = async { f.lifecycle.synchronize(true, refreshToken = true) }; runCurrent()
        assertEquals(before, f.journal.current().revision); hold.complete(Unit); assertTrue(read.await()); refresh.await()
        assertEquals(1, effects); assertTrue(f.journal.current().revision > before)
        assertTrue(f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Open, { lease, _, _ ->
            assertEquals(f.journal.current().revision, lease.revision); response() }) { effects++ })
    }
    @Test fun permissionRemovalAndUnconfirmedRegistrationNeverResolve() = runTest {
        val f = Fixture(); val request = f.ready(); f.lifecycle.synchronize(false)
        assertFalse(f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Display, { _, _, _ -> error("Must not request") }) { error("Must not display") })
    }
    @Test fun signoutInvalidatesAuthorityBeforeThePlatformNotificationCleanupHook() = runTest {
        val f = Fixture(); val request = f.ready(); var cleanups = 0
        assertEquals(SessionExitResult.Confirmed, f.lifecycle.prepareSignOut {
            assertFalse(f.lifecycle.acceptsAlert(request)); assertNotNull(f.journal.current().signOutUid); cleanups++
        })
        assertEquals(1, cleanups)
    }
    @Test fun permissionWithdrawalImmediatelyPersistsOneRemovalWithoutSigningTheUserOut() = runTest {
        val f = Fixture(); val request = f.ready(); f.lifecycle.notificationsDisabled()
        val removed = f.journal.current(); assertEquals("parent", removed.ownerUid); assertNull(removed.signOutUid)
        assertTrue(removed.needsTokenDeletion); assertNotNull(removed.pending); assertNull(removed.pending!!.token)
        assertNull(removed.confirmed); f.lifecycle.notificationsDisabled(); assertEquals(removed, f.journal.current())
        assertFalse(f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Display, { _, _, _ -> error("Must not request") }) { error("Must not display") })
    }
    @Test fun permissionWithdrawalDuringResolutionRejectsTheReceiptBeforeDisplay() = runTest {
        val f = Fixture(); val request = f.ready(); val hold = CompletableDeferred<Unit>()
        val job = async { f.lifecycle.resolveAlert(request, TeamPushAlertPurpose.Display, { _, _, _ -> hold.await(); response() }) { error("Must not display") } }
        runCurrent(); f.lifecycle.notificationsDisabled(); hold.complete(Unit); assertFalse(job.await())
    }
    @Test fun reenablingNotificationsNeedsNewTokenConfirmationButKeepsTheCurrentAccountEpoch() = runTest {
        val f = Fixture(); val request = f.ready(); f.lifecycle.notificationsDisabled(); val removed = f.journal.current().revision
        f.lifecycle.synchronize(true); assertTrue(f.journal.confirmedFor("parent")); assertTrue(f.journal.current().revision > removed)
        assertEquals(request.epoch, f.journal.current().epoch)
    }
}
