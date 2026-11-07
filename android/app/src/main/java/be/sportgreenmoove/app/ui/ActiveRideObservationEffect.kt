package be.sportgreenmoove.app.ui

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.services.RideObservationGateway

@Composable
internal fun rememberActiveRideObservation(gateway: RideObservationGateway, uid: String?, ride: LiveRideSnapshot?, appData: AppDataState,
    onEnded: (String) -> Unit): ActiveRideObservationState {
    val owner = LocalLifecycleOwner.current
    val ended by rememberUpdatedState(onEnded)
    val currentUid by rememberUpdatedState(uid)
    val state = remember(gateway, uid, ride?.rideSessionId, appData) {
        val sink = appData.rideObserverSink(ride?.rideSessionId)
        ActiveRideObservationState(ride, gateway, { snapshot ->
            sink(snapshot)
            if (snapshot == null && uid != null && currentUid == uid) ended(uid)
        }, SystemClock::elapsedRealtime)
    }
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner, state.attempt) {
        if (uid != null) owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { state.observe() }
    }
    return state
}
