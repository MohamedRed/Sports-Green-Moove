package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.RideObservation
import be.sportgreenmoove.app.data.RideObservationUpdate
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.services.RideObservationGateway
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ActiveRideObservationStateTest {
    @Test fun positionsAgeWithoutNewPacketsAndIgnoreWallClock() = runTest {
        val updates = MutableSharedFlow<RideObservationUpdate>()
        var displayed: LiveRideSnapshot? = null
        val state = ActiveRideObservationState(ride(), gateway(updates), { displayed = it }, { testScheduler.currentTime })
        val job = backgroundScope.launch(start = CoroutineStart.UNDISPATCHED) { state.observe() }
        updates.emit(RideObservationUpdate(ride(), 0)); runCurrent()
        assertEquals(RideObservationPhase.Live, state.phase); assertFalse(displayed!!.stale)
        advanceTimeBy(90_000); runCurrent(); assertFalse(displayed!!.stale)
        advanceTimeBy(1_000); runCurrent(); assertTrue(displayed!!.stale)
        assertEquals("Secours GPS · il y a 1 min", displayed!!.vehicleLastUpdateLabel)
        updates.emit(RideObservationUpdate(ride(), 0)); runCurrent(); assertFalse(displayed!!.stale)
        job.cancelAndJoin(); assertEquals(RideObservationPhase.Paused, state.phase); assertTrue(displayed!!.stale)
    }
    @Test fun includesTheWholeRequestDurationRatherThanMakingASlowResponseLookNew() = runTest {
        val updates = MutableSharedFlow<RideObservationUpdate>()
        var displayed: LiveRideSnapshot? = null
        val state = ActiveRideObservationState(ride(), gateway(updates), { displayed = it }, { testScheduler.currentTime })
        backgroundScope.launch(start = CoroutineStart.UNDISPATCHED) { state.observe() }
        updates.emit(RideObservationUpdate(ride().copy(observation = timing(89_500)), 1_000)); runCurrent()
        assertTrue(displayed!!.stale)
    }
    @Test fun remotePassengerChangesAndCompletionReplaceTheSameRideWithoutNavigation() = runTest {
        val updates = MutableSharedFlow<RideObservationUpdate>()
        val received = mutableListOf<LiveRideSnapshot?>()
        val state = ActiveRideObservationState(ride(), gateway(updates), received::add, { testScheduler.currentTime })
        val job = backgroundScope.launch(start = CoroutineStart.UNDISPATCHED) { state.observe() }
        val passenger = RidePassengerStatus("booking", "child", "Enfant QA", "pickedUp", "pending")
        updates.emit(RideObservationUpdate(ride().copy(passengers = listOf(passenger)), 0)); runCurrent()
        assertEquals("pickedUp", received.last()!!.passengers.single().pickupStatus)
        updates.emit(RideObservationUpdate(null, 0)); runCurrent()
        assertEquals(RideObservationPhase.Ended, state.phase); assertNull(received.last()); assertTrue(job.isCompleted)
    }
    @Test fun errorsNeverLeaveALiveBadgeAndDoNotAutomaticallyRetry() = runTest {
        var attempts = 0
        val gateway = object : RideObservationGateway {
            override fun observeRide(rideSessionId: String) = flow<RideObservationUpdate> { attempts++; throw ErrorForTest() }
        }
        var displayed: LiveRideSnapshot? = null
        val state = ActiveRideObservationState(ride(), gateway, { displayed = it }, { 0 })
        state.observe(); assertEquals(RideObservationPhase.Failed, state.phase)
        assertTrue(displayed!!.stale); assertEquals(1, attempts)
        state.retry(); assertEquals(1, state.attempt); assertEquals(1, attempts)
    }
    @Test fun mismatchedRideAndMissingObservationFailClosed() = runTest {
        for (invalid in listOf(ride().copy(rideSessionId = "other-ride"), ride().copy(observation = null))) {
            val state = ActiveRideObservationState(ride(), object : RideObservationGateway {
                override fun observeRide(rideSessionId: String) = flow { emit(RideObservationUpdate(invalid, 0)) }
            }, {}, { 0 })
            state.observe(); assertEquals(RideObservationPhase.Failed, state.phase)
        }
    }
    @Test fun closingASessionPreventsAnOldFlowFromPublishingAgain() = runTest {
        val updates = MutableSharedFlow<RideObservationUpdate>()
        val received = mutableListOf<LiveRideSnapshot?>()
        val state = ActiveRideObservationState(ride(), gateway(updates), received::add, { 0 })
        backgroundScope.launch(start = CoroutineStart.UNDISPATCHED) { state.observe() }
        updates.emit(RideObservationUpdate(ride(), 0)); runCurrent()
        state.close(); val count = received.size
        updates.emit(RideObservationUpdate(ride().copy(status = "old-account"), 0)); runCurrent()
        assertEquals(count, received.size); assertEquals(RideObservationPhase.Idle, state.phase)
    }
    private class ErrorForTest : IllegalStateException("Private provider diagnostics must not become UI copy")
    private fun gateway(updates: MutableSharedFlow<RideObservationUpdate>) = object : RideObservationGateway {
        override fun observeRide(rideSessionId: String) = updates
    }
    private fun timing(age: Long = 0) = RideObservation(age, null, true, false, "nativeFallback", null)
    private fun ride() = LiveRideSnapshot("qa-ride", "qa-trip", "qa-driver", "Actif", "old label", null, "ETA à calculer", false,
        observation = timing())
}
