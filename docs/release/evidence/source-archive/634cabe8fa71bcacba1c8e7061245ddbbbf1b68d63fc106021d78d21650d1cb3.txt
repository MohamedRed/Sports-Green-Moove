package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.resumeOwnedRideTracking
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

internal fun launchActiveRideResume(scope: CoroutineScope, providers: AndroidProviderSet, role: AppRole,
    ride: LiveRideSnapshot?, permissionGate: ActiveRidePermissionGate, currentUid: () -> String?,
    setRide: (LiveRideSnapshot) -> Unit, setScreen: (AppScreen) -> Unit, setError: (String?) -> Unit) {
    val ownerUid = currentUid() ?: return
    val expected = ride ?: return
    if (role !in setOf(AppRole.Driver, AppRole.Child)) { setScreen(AppScreen.Ride); return }
    permissionGate.runWhenReady {
        scope.launch {
            if (currentUid() != ownerUid) return@launch
            setError(null)
            runCatching {
                val resumed = providers.resumeOwnedRideTracking(expected.rideSessionId, ownerUid, role)
                if (currentUid() == ownerUid) { setRide(resumed); setScreen(AppScreen.Ride) }
            }.onFailure { if (currentUid() == ownerUid) setError(UserFacingErrorPolicy.messageFor(it)) }
        }
    }
}
