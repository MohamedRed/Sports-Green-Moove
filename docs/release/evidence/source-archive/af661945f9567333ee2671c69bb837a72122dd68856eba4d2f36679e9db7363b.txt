package be.sportgreenmoove.app.services

internal enum class RideLifecycleDecision { KEEP, STOP, AWAIT_SERVER }

internal fun rideLifecycleDecision(
    lease: RideLocationLease,
    fromCache: Boolean,
    exists: Boolean,
    status: String?,
    driverUserId: String?,
    childUserIds: List<*>?,
): RideLifecycleDecision {
    if (fromCache) return RideLifecycleDecision.AWAIT_SERVER
    if (!exists || status != "active") return RideLifecycleDecision.STOP
    val authorized = when (lease.role) {
        "driver" -> driverUserId == lease.ownerUid
        "child" -> childUserIds?.contains(lease.ownerUid) == true
        else -> false
    }
    return if (authorized) RideLifecycleDecision.KEEP else RideLifecycleDecision.STOP
}
