package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionShutdownStateTest {
    @Test fun duplicateActionsDoNotDuplicatePreparationAndBeforeRunsBeforeTheFirstSuspend() = runTest {
        val receipt = CompletableDeferred<Unit>(); val events = mutableListOf<String>()
        val state = SessionShutdownState(this) { events += "request"; receipt.await() }
        state.start({ events += "hide" }, { events += "done:$it" })
        assertTrue(state.pending); assertEquals(listOf("hide", "request"), events)
        state.start({ error("Must not repeat") }, { error("Must not repeat") })
        receipt.complete(Unit); runCurrent()
        assertEquals(listOf("hide", "request", "done:false"), events); assertFalse(state.pending)
    }
    @Test fun aPreparationFailureStillFinishesTheUiWithoutExposingPrivateExceptionText() = runTest {
        var failed: Boolean? = null
        val state = SessionShutdownState(this) { error("private-provider-debug-detail") }
        state.start({}, { failed = it })
        assertEquals(true, failed); assertFalse(state.pending)
    }
    @Test fun aBeforeHookFailureCannotSkipTheActualSessionTermination() = runTest {
        var exits = 0; var failed: Boolean? = null
        val state = SessionShutdownState(this) { exits++ }
        state.start({ error("Synthetic draft cleanup failure") }, { failed = it })
        assertEquals(1, exits); assertEquals(true, failed); assertFalse(state.pending)
    }
    @Test fun cancelledPreparationAlwaysClearsAuthBeforeTheUiBecomesAvailable() = runTest {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        val events = mutableListOf<String>(); val hold = CompletableDeferred<Unit>()
        val auth = object : AuthGateway by UnconfiguredAuthGateway() {
            override suspend fun prepareSignOut(): SessionExitResult { events += "prepare"; hold.await(); return SessionExitResult.Confirmed }
            override fun signOut() { events += "auth-cleared" }
        }
        val state = SessionShutdownState(scope) { signOutProviders(AndroidProviderSet(auth, UnconfiguredFirebaseGateway()), StandardTestDispatcher(testScheduler)) }
        state.start({}, { events += "ui-finished:$it" }); runCurrent(); scope.cancel(); runCurrent()
        assertEquals(listOf("prepare", "auth-cleared", "ui-finished:true"), events); assertFalse(state.pending)
    }
    @Test fun evenAnAlreadyCancelledUiScopeCannotDiscardTheLogoutAction() = runTest {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)); scope.cancel()
        var localExits = 0
        val auth = object : AuthGateway by UnconfiguredAuthGateway() { override fun signOut() { localExits++ } }
        val state = SessionShutdownState(scope) { signOutProviders(AndroidProviderSet(auth, UnconfiguredFirebaseGateway()), StandardTestDispatcher(testScheduler)) }
        state.start({}, {}); runCurrent()
        assertEquals(1, localExits); assertFalse(state.pending)
    }
    @Test fun aNonResponsiveGatewayCannotHoldTheUiOrSkipItsForcedAuthCleanup() = runTest {
        var exits = 0; var failed: Boolean? = null
        val auth = object : AuthGateway by UnconfiguredAuthGateway() {
            override suspend fun prepareSignOut(): SessionExitResult { delay(30_000); error("Must time out") }
            override fun signOut() { exits++ }
        }
        val state = SessionShutdownState(this) { signOutProviders(AndroidProviderSet(auth, UnconfiguredFirebaseGateway()), StandardTestDispatcher(testScheduler)) }
        state.start({}, { failed = it }); advanceTimeBy(2_999); runCurrent(); assertTrue(state.pending)
        advanceTimeBy(1); runCurrent(); assertEquals(1, exits); assertEquals(true, failed); assertFalse(state.pending)
    }
    @Test fun offlineNotificationCleanupIsPendingRatherThanAFalseFailedLocalLogout() = runTest {
        var exits = 0
        val auth = object : AuthGateway by UnconfiguredAuthGateway() {
            override suspend fun prepareSignOut() = SessionExitResult.Pending
            override fun signOut() { exits++ }
        }
        assertEquals(SessionExitResult.Pending, signOutProviders(AndroidProviderSet(auth, UnconfiguredFirebaseGateway()), StandardTestDispatcher(testScheduler)))
        assertEquals(1, exits)
    }
}
