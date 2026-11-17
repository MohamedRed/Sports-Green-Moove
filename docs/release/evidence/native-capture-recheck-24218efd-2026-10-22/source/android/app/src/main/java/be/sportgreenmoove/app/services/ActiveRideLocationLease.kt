package be.sportgreenmoove.app.services

internal data class RideLocationLease(val ownerUid: String, val rideSessionId: String, val role: String, val authRevision: Long)

internal class ActiveRideLocationLease(private val currentUid: () -> String?, private val currentRevision: () -> Long) {
    private var active: RideLocationLease? = null

    @Synchronized fun bind(ownerUid: String?, rideSessionId: String?, role: String?, revision: Long): RideLocationLease? {
        if (ownerUid.isNullOrBlank() || rideSessionId.isNullOrBlank() || role !in setOf("driver", "child") ||
            currentUid() != ownerUid || currentRevision() != revision)
            return null
        active?.takeIf { it.ownerUid == ownerUid && it.rideSessionId == rideSessionId && it.role == role && it.authRevision == revision }?.let { return it }
        return RideLocationLease(ownerUid, rideSessionId, requireNotNull(role), revision).also { active = it }
    }

    @Synchronized fun snapshot(): RideLocationLease? = active?.takeIf { accepts(it) }
    @Synchronized fun accepts(lease: RideLocationLease): Boolean = active === lease && lease.ownerUid == currentUid() && lease.authRevision == currentRevision()
    @Synchronized fun ownerChanged(): Boolean {
        if (active == null || snapshot() != null) return false
        active = null
        return true
    }
    @Synchronized fun clear() { active = null }
}
