package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.domain.ageRideObservation
import be.sportgreenmoove.app.services.RideObservationGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.takeWhile
import kotlinx.coroutines.launch

enum class RideObservationPhase { Idle, Loading, Live, Paused, Failed, Ended }

class ActiveRideObservationState internal constructor(
    private val initialRide: LiveRideSnapshot?, private val gateway: RideObservationGateway,
    private val apply: (LiveRideSnapshot?) -> Unit, private val clock: () -> Long,
) {
    var phase by mutableStateOf(if (initialRide == null) RideObservationPhase.Idle else RideObservationPhase.Loading)
        private set
    var attempt by mutableIntStateOf(0)
        private set
    private var generation = 0L
    private var last: LiveRideSnapshot? = null
    private var receivedAt = 0L
    private var requestDuration = 0L

    fun retry() { attempt += 1 }
    internal fun close() { generation += 1; last = null; phase = RideObservationPhase.Idle }

    internal suspend fun observe() {
        val rideId = initialRide?.rideSessionId ?: return
        val request = ++generation
        phase = RideObservationPhase.Loading
        apply((last ?: initialRide).copy(stale = true))
        try {
            coroutineScope {
                val ticker = launch {
                    while (true) { delay(1_000); if (request == generation && phase == RideObservationPhase.Live) publish() }
                }
                try {
                    gateway.observeRide(rideId).takeWhile { update ->
                        currentCoroutineContext().ensureActive()
                        if (request != generation) return@takeWhile false
                        require(update.requestDurationMs >= 0)
                        check(update.ride == null || update.ride.rideSessionId == rideId) { "Le trajet a changé." }
                        last = update.ride
                        receivedAt = clock()
                        requestDuration = update.requestDurationMs
                        if (update.ride == null) { phase = RideObservationPhase.Ended; apply(null) }
                        else { phase = RideObservationPhase.Live; publish() }
                        update.ride != null
                    }.collect()
                    if (request == generation && phase != RideObservationPhase.Ended) error("Le suivi s’est interrompu.")
                } finally { ticker.cancel() }
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (request == generation) phase = RideObservationPhase.Failed }
        finally {
            if (request == generation) {
                generation += 1
                if (phase == RideObservationPhase.Live || phase == RideObservationPhase.Loading) phase = RideObservationPhase.Paused
                if (phase != RideObservationPhase.Ended) apply((last ?: initialRide).copy(stale = true))
            }
        }
    }

    private fun publish() {
        val ride = last ?: return
        val elapsed = clock() - receivedAt
        require(elapsed >= 0)
        val total = if (requestDuration > Long.MAX_VALUE - elapsed) Long.MAX_VALUE else elapsed + requestDuration
        apply(ageRideObservation(ride, total))
    }
}
