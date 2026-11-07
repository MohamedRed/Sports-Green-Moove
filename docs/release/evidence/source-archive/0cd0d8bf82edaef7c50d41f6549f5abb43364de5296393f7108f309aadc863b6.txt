package be.sportgreenmoove.app.services

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class TeamPushLifecycleTest {
    private class Memory : TeamPushStorage {
        var value: TeamPushRecord? = null
        override fun read() = value
        override fun update(change: (TeamPushRecord?) -> TeamPushRecord) = change(value).also { value = it }
    }
    private class Fixture {
        var uid: String? = "parent"
        var adult = true
        var autoInit = false
        var retrieved = 0
        var deleted = 0
        val token = "synthetic_" + "T".repeat(80)
        val journal = TeamPushJournal(Memory())
        val calls = mutableListOf<TeamPushCommand>()
        var tokenAction: suspend () -> String = { token }
        var deleteAction: suspend () -> Unit = {}
        var callAction: suspend (TeamPushCommand) -> TeamPushReceipt = {
            TeamPushReceipt(it.uid, it.revision, it.token != null, false)
        }
        val source = object : TeamPushTokenSource {
            override fun setAutoInit(enabled: Boolean) { autoInit = enabled }
            override suspend fun token(): String { retrieved++; return tokenAction() }
            override suspend fun deleteToken() { deleted++; deleteAction() }
        }
        val lifecycle = TeamPushLifecycle(journal, source, { uid }, { adult }) { calls += it; callAction(it) }
        fun account(value: String?) { uid = value; lifecycle.accountChanged(value) }
    }
    @Test fun aGrantedAdultRegistersAndOrdinaryResumeDoesNotAllocateAnotherRevision() = runTest {
        val f = Fixture()
        assertEquals(TeamPushSyncResult.Registered, f.lifecycle.synchronize(true))
        val before = f.journal.current()
        assertEquals(TeamPushSyncResult.Registered, f.lifecycle.synchronize(true))
        assertEquals(before, f.journal.current()); assertEquals(1, f.retrieved); assertEquals(1, f.calls.size); assertTrue(f.autoInit)
    }
    @Test fun tokenRefreshUsesANewerRevisionAndConfirmsOnlyTheNewToken() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true); val old = f.calls.single()
        f.tokenAction = { f.token + "new" }; f.lifecycle.synchronize(true, refreshToken = true)
        assertEquals(2, f.calls.size); assertTrue(f.calls.last().revision > old.revision)
        assertEquals(teamPushHash(f.token + "new"), f.journal.current().confirmed?.tokenHash)
    }
    @Test fun deniedPermissionRemovesOnlyThisInstallationAndDeletesTheProviderToken() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true); val installation = f.journal.current().identity
        assertEquals(TeamPushSyncResult.Inactive, f.lifecycle.synchronize(false))
        assertEquals(installation, f.calls.last().identity); assertNull(f.calls.last().token)
        assertEquals(1, f.deleted); assertFalse(f.autoInit); assertFalse(f.journal.confirmedFor("parent"))
        f.lifecycle.synchronize(false); assertEquals(2, f.calls.size); assertEquals(1, f.deleted); assertEquals(1, f.retrieved)
    }
    @Test fun childOrUninitializedClaimsDoNotAcquireAToken() = runTest {
        val f = Fixture(); f.adult = false
        assertEquals(TeamPushSyncResult.Inactive, f.lifecycle.synchronize(true))
        assertFalse(f.autoInit); assertEquals(0, f.retrieved); assertTrue(f.calls.isEmpty())
    }
    @Test fun losingAdultEligibilityRemovesAnAlreadyConfirmedBinding() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true); f.adult = false
        f.lifecycle.synchronize(true)
        assertNull(f.calls.last().token); assertFalse(f.autoInit); assertEquals(1, f.deleted)
    }
    @Test fun aLostRemovalResponseStillDeletesTheTokenAndRetainsTheExactRetry() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true)
        f.callAction = { error("Synthetic lost response") }
        try { f.lifecycle.synchronize(false); fail() } catch (_: IllegalStateException) { }
        val pending = f.journal.current().pending; assertNotNull(pending); assertNull(pending!!.token)
        assertEquals(1, f.deleted); assertFalse(f.autoInit)
        f.callAction = { TeamPushReceipt(it.uid, it.revision, false, true) }
        f.lifecycle.synchronize(false)
        assertEquals(pending, f.calls.last()); assertNull(f.journal.current().pending); assertEquals(1, f.deleted)
    }
    @Test fun aLostActivationResponseRetriesThePersistedCommandBeforeAnyNewTokenRetrieval() = runTest {
        val f = Fixture(); f.callAction = { error("Synthetic lost response") }
        try { f.lifecycle.synchronize(true); fail() } catch (_: IllegalStateException) { }
        val original = f.calls.single(); assertEquals(original, f.journal.current().pending)
        f.callAction = { TeamPushReceipt(it.uid, it.revision, true, true) }
        f.lifecycle.synchronize(true)
        assertEquals(listOf(original, original), f.calls); assertEquals(1, f.retrieved); assertTrue(f.journal.confirmedFor("parent"))
    }
    @Test fun signoutBlocksReactivationEvenBeforeFirebaseHasClearedItsCurrentUser() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true); f.lifecycle.signedOut()
        f.lifecycle.accountChanged("parent")
        assertNull(f.journal.current().ownerUid)
        assertEquals(TeamPushSyncResult.Inactive, f.lifecycle.synchronize(true, true))
        assertEquals(1, f.calls.size); assertEquals(1, f.retrieved); assertEquals(1, f.deleted); assertFalse(f.autoInit)
        f.account(null); f.account("parent"); f.lifecycle.synchronize(true)
        assertNull(f.calls[1].token); assertTrue(f.journal.confirmedFor("parent"))
    }
    @Test fun anOfflineLogoutDoesNotReplayThePreviousOwnersRemovalAsTheNextUser() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true); f.lifecycle.signedOut(); f.account(null); f.account("driver")
        val next = f.calls.size; f.lifecycle.synchronize(true)
        assertEquals(1, f.deleted); assertEquals(listOf("driver"), f.calls.drop(next).map { it.uid })
        assertTrue(f.journal.confirmedFor("driver")); assertFalse(f.journal.confirmedFor("parent"))
    }
    @Test fun failedProviderDeletionPreventsAnotherAccountFromFetchingOrBindingAToken() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true); f.account("driver")
        f.deleteAction = { error("Synthetic deletion failure") }
        try { f.lifecycle.synchronize(true); fail() } catch (_: IllegalStateException) { }
        assertEquals(1, f.retrieved); assertEquals(1, f.calls.size); assertTrue(f.journal.current().needsTokenDeletion); assertFalse(f.autoInit)
        f.deleteAction = {}; f.lifecycle.synchronize(true)
        assertTrue(f.journal.confirmedFor("driver")); assertEquals(2, f.deleted)
    }
    @Test fun aTokenRetrievalFinishingAfterAnAccountChangeCannotCreateAPendingCommand() = runTest {
        val f = Fixture(); val response = CompletableDeferred<String>(); f.tokenAction = { response.await() }
        val operation = async { f.lifecycle.synchronize(true) }; runCurrent()
        f.account("driver"); response.complete(f.token)
        try { operation.await(); fail() } catch (_: CancellationException) { }
        assertTrue(f.calls.isEmpty()); assertNull(f.journal.current().pending); assertFalse(f.journal.confirmedFor("driver"))
    }
    @Test fun aServerAcknowledgementFinishingAfterAnAccountChangeCannotConfirmTheOldAccount() = runTest {
        val f = Fixture(); val response = CompletableDeferred<TeamPushReceipt>(); f.callAction = { response.await() }
        val operation = async { f.lifecycle.synchronize(true) }; runCurrent(); val old = f.calls.single()
        f.account("driver"); response.complete(TeamPushReceipt(old.uid, old.revision, true, false))
        try { operation.await(); fail() } catch (_: CancellationException) { }
        assertNull(f.journal.current().confirmed); assertNull(f.journal.current().pending); assertTrue(f.journal.current().needsTokenDeletion)
    }
    @Test fun returningToTheSameAccountCannotConsumeThePriorSessionsTokenCallback() = runTest {
        val f = Fixture(); val response = CompletableDeferred<String>(); f.tokenAction = { response.await() }
        val operation = async { f.lifecycle.synchronize(true) }; runCurrent()
        f.account(null); f.account("parent"); response.complete(f.token)
        try { operation.await(); fail() } catch (_: CancellationException) { }
        assertTrue(f.calls.isEmpty()); assertTrue(f.journal.current().needsTokenDeletion)
    }
    @Test fun aFailedCallableCannotManufactureAConfirmedRegistration() = runTest {
        val f = Fixture(); f.callAction = { TeamPushReceipt("other", it.revision, true, false) }
        try { f.lifecycle.synchronize(true); fail() } catch (_: IllegalStateException) { }
        assertNotNull(f.journal.current().pending); assertFalse(f.journal.confirmedFor("parent"))
    }
    @Test fun concurrentLifecycleEventsShareTheSameInFlightRegistration() = runTest {
        val f = Fixture(); val response = CompletableDeferred<TeamPushReceipt>(); f.callAction = { response.await() }
        val first = async { f.lifecycle.synchronize(true) }; runCurrent()
        val second = async { f.lifecycle.synchronize(true) }; runCurrent()
        assertEquals(1, f.calls.size); val command = f.calls.single()
        response.complete(TeamPushReceipt(command.uid, command.revision, true, false))
        assertEquals(TeamPushSyncResult.Registered, first.await()); assertEquals(TeamPushSyncResult.Registered, second.await())
        assertEquals(1, f.calls.size); assertEquals(1, f.retrieved)
    }
    @Test fun signoutDuringTokenRetrievalCannotBindTheOldSession() = runTest {
        val f = Fixture(); val response = CompletableDeferred<String>(); f.tokenAction = { response.await() }
        val operation = async { f.lifecycle.synchronize(true) }; runCurrent(); f.lifecycle.signedOut(); response.complete(f.token)
        try { operation.await(); fail() } catch (_: CancellationException) { }
        assertTrue(f.calls.isEmpty()); assertNull(f.journal.current().ownerUid); assertFalse(f.autoInit)
        f.account(null); f.lifecycle.synchronize(true); assertEquals(1, f.deleted)
    }
    @Test fun aStaleSdkDeletionCompletionCannotUnlockANewerAccount() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true); f.account("driver")
        val deletion = CompletableDeferred<Unit>(); f.deleteAction = { deletion.await() }
        val operation = async { f.lifecycle.synchronize(true) }; runCurrent(); f.account("manager"); deletion.complete(Unit)
        try { operation.await(); fail() } catch (_: CancellationException) { }
        assertTrue(f.journal.current().needsTokenDeletion); assertFalse(f.autoInit); assertEquals(1, f.retrieved)
        f.deleteAction = {}; f.lifecycle.synchronize(true); assertTrue(f.journal.confirmedFor("manager")); assertEquals(2, f.deleted)
    }
    @Test fun permissionGrantAfterRemovalUsesAFreshRevision() = runTest {
        val f = Fixture(); f.lifecycle.synchronize(true); f.lifecycle.synchronize(false); val removed = f.calls.last()
        f.tokenAction = { f.token + "fresh" }; f.lifecycle.synchronize(true)
        assertTrue(f.calls.last().revision > removed.revision); assertEquals(f.token + "fresh", f.calls.last().token)
        assertEquals(2, f.retrieved); assertEquals(1, f.deleted); assertTrue(f.autoInit)
    }
    @Test fun signedOutInstallationsNeverGenerateAToken() = runTest {
        val f = Fixture(); f.account(null)
        assertEquals(TeamPushSyncResult.Inactive, f.lifecycle.synchronize(true))
        assertFalse(f.autoInit); assertEquals(0, f.retrieved); assertTrue(f.calls.isEmpty())
    }
    @Test fun failedTokenFetchCannotLeaveAutomaticRegistrationEnabled() = runTest {
        val f = Fixture(); f.tokenAction = { error("Synthetic unavailable token") }
        try { f.lifecycle.synchronize(true); fail() } catch (_: IllegalStateException) { }
        assertFalse(f.autoInit); assertFalse(f.journal.confirmedFor("parent")); assertTrue(f.calls.isEmpty())
        f.tokenAction = { f.token }; f.lifecycle.synchronize(true)
        assertTrue(f.journal.confirmedFor("parent")); assertEquals(2, f.retrieved); assertEquals(1, f.calls.size)
    }
    @Test fun missingOrMixedChildClaimsNeverBecomeAnAdultRegistration() {
        for (claims in listOf(emptyMap(), mapOf("roleKeys" to listOf("child", "parent")),
            mapOf("roleKeys" to listOf("admin")), mapOf("roleKeys" to listOf("parent", 1)), mapOf("roles" to mapOf("parent" to true))))
            assertFalse(teamPushAdultClaims(claims))
        for (role in listOf("parent", "driver", "clubManager")) assertTrue(teamPushAdultClaims(mapOf("roleKeys" to listOf(role))))
    }
}
