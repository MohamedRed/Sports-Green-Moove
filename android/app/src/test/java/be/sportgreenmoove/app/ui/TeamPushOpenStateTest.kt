package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.TeamPushAlertGateway
import be.sportgreenmoove.app.services.TeamPushAlertUnavailableException
import be.sportgreenmoove.app.services.TeamPushOpenRequest
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TeamPushOpenStateTest {
    private val request = TeamPushOpenRequest("teamChat_" + "a".repeat(64), "parent", 1)
    private val target = TeamConversationTarget("team", "b".repeat(64))
    private fun gateway(block: suspend () -> TeamConversationTarget?) = object : TeamPushAlertGateway {
        override suspend fun open(request: TeamPushOpenRequest) = block()
    }
    @Test fun noPrivateTeamTargetExistsBeforeTheActualAuthorityReceipt() = runTest {
        val receipt = CompletableDeferred<TeamConversationTarget?>()
        val state = TeamPushOpenState(request, "parent", true, gateway { receipt.await() })
        val load = launch { state.load() }; runCurrent()
        assertEquals(TeamPushOpenPhase.Loading, state.phase); assertNull(state.target)
        receipt.complete(target); load.join(); assertEquals(TeamPushOpenPhase.Open, state.phase); assertEquals(target, state.target)
    }
    @Test fun aDifferentAccountChildOrMissingGatewayCannotResolveTheRequest() = runTest {
        for (state in listOf(TeamPushOpenState(request, "driver", true, gateway { error("Must not call") }),
            TeamPushOpenState(request, "parent", false, gateway { error("Must not call") }),
            TeamPushOpenState(request, "parent", true, null))) {
            state.load(); assertEquals(TeamPushOpenPhase.Unavailable, state.phase); assertNull(state.target)
        }
    }
    @Test fun suppressionAndExplicitAuthorityWithdrawalHaveNoRetryOrTarget() = runTest {
        for (gateway in listOf(gateway { null }, gateway { throw TeamPushAlertUnavailableException() })) {
            val state = TeamPushOpenState(request, "parent", true, gateway); state.load()
            assertEquals(TeamPushOpenPhase.Unavailable, state.phase); assertNull(state.target)
        }
    }
    @Test fun failedReadRemainsRetryableUntilAnotherActualResultArrives() = runTest {
        var calls = 0
        val state = TeamPushOpenState(request, "parent", true, gateway { if (calls++ == 0) error("private detail") else target })
        state.load(); assertEquals(TeamPushOpenPhase.Retry, state.phase); assertNull(state.target)
        state.load(); assertEquals(TeamPushOpenPhase.Open, state.phase); assertEquals(target, state.target); assertEquals(2, calls)
    }
    @Test fun closingTheRouteRejectsALateResultAndFutureLoads() = runTest {
        var calls = 0; val hold = CompletableDeferred<TeamConversationTarget?>()
        val state = TeamPushOpenState(request, "parent", true, gateway { calls++; hold.await() })
        val load = launch { state.load() }; runCurrent(); state.close(); hold.complete(target); load.join(); state.load()
        assertEquals(1, calls); assertNull(state.target); assertEquals(TeamPushOpenPhase.Loading, state.phase)
    }
    @Test fun returningFromBackgroundRequiresAnotherReceiptAndCannotAcceptTheOldAttempt() = runTest {
        val old = CompletableDeferred<TeamConversationTarget?>(); var calls = 0
        val state = TeamPushOpenState(request, "parent", true, gateway { if (++calls == 1) old.await() else null })
        val first = launch { state.load() }; runCurrent(); state.hide(); state.load(); old.complete(target); first.join()
        assertEquals(2, calls); assertNull(state.target); assertEquals(TeamPushOpenPhase.Unavailable, state.phase)
    }
    @Test fun cancellationDoesNotBecomeAnAvailableResultOrAnAutomaticRetry() = runTest {
        val state = TeamPushOpenState(request, "parent", true, gateway { throw CancellationException() })
        try { state.load(); fail("Must preserve cancellation") } catch (_: CancellationException) { }
        assertNull(state.target); assertEquals(TeamPushOpenPhase.Loading, state.phase)
    }
}
