package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class ActiveRideLifecycleTest {
    private val driver = RideLocationLease("driver", "ride", "driver", 0)
    private val child = RideLocationLease("child", "ride", "child", 0)
    private fun decision(lease: RideLocationLease = driver, cache: Boolean = false, exists: Boolean = true,
        status: String? = "active", owner: String? = "driver", children: List<*>? = listOf("child")) =
        rideLifecycleDecision(lease, cache, exists, status, owner, children)

    @Test fun matchingServerConfirmedDriverRemainsActive() { assertEquals(RideLifecycleDecision.KEEP, decision()) }
    @Test fun matchingServerConfirmedChildRemainsActive() { assertEquals(RideLifecycleDecision.KEEP, decision(child)) }
    @Test fun completedCancelledMissingAndMalformedServerRidesStopTracking() {
        for (status in listOf("completed", "cancelled", "", null)) assertEquals(RideLifecycleDecision.STOP, decision(status = status))
        assertEquals(RideLifecycleDecision.STOP, decision(exists = false))
    }
    @Test fun driverReplacementAndChildRemovalStopTracking() {
        assertEquals(RideLifecycleDecision.STOP, decision(owner = "other"))
        assertEquals(RideLifecycleDecision.STOP, decision(owner = null))
        for (children in listOf(null, emptyList<Any>(), listOf("other"), listOf(123)))
            assertEquals(RideLifecycleDecision.STOP, decision(child, children = children))
    }
    @Test fun cachedActiveOrTerminalStateCannotAuthorizeOrTerminateTheCurrentLease() {
        for (status in listOf("active", "completed", null))
            assertEquals(RideLifecycleDecision.AWAIT_SERVER, decision(cache = true, exists = false, status = status))
    }
    @Test fun oldTerminalCallbackCannotAffectANewRideOrAuthenticationSession() {
        var uid: String? = "driver"; var revision = 0L
        val ownership = ActiveRideLocationLease({ uid }, { revision })
        val old = requireNotNull(ownership.bind("driver", "old", "driver", 0))
        val current = requireNotNull(ownership.bind("driver", "new", "driver", 0))
        assertFalse(ownership.accepts(old)); assertTrue(ownership.accepts(current))
        revision++; assertFalse(ownership.accepts(current))
        uid = null; assertFalse(ownership.accepts(old))
    }
}
