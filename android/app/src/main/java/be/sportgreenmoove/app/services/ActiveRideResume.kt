package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot

internal suspend fun AndroidProviderSet.resumeOwnedRideTracking(rideSessionId: String, ownerUid: String, role: AppRole): LiveRideSnapshot {
    require(role in setOf(AppRole.Driver, AppRole.Child))
    val session = auth.currentSession()
    check(session?.uid == ownerUid && role in session.roles) { "La session de suivi a changé." }
    val ride = firebase.getActiveRide() ?: error("Aucune course active accessible.")
    check(ride.rideSessionId == rideSessionId) { "La course active a changé." }
    check(role != AppRole.Driver || ride.driverUserId == ownerUid) { "Cette course appartient à un autre conducteur." }
    check(auth.currentSession()?.uid == ownerUid) { "La session de suivi a changé." }
    firebase.writeNativeLocationFallback(rideSessionId, role)
    check(auth.currentSession()?.uid == ownerUid) { "La session de suivi a changé." }
    return ride
}
