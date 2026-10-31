package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class ActiveRideLocationLeaseTest {
    private var uid: String? = "driver"
    private var revision = 0L
    private val ownership = ActiveRideLocationLease({ uid }, { revision })
    private fun bind(ride: String = "ride") = requireNotNull(ownership.bind("driver", ride, "driver", revision))

    @Test fun sameAuthorizedStartIsIdempotent() {
        val lease = bind(); assertSame(lease, bind()); assertSame(lease, ownership.snapshot())
    }
    @Test fun signedOutCallbacksAreRejectedBeforeTheAuthListenerRuns() {
        val lease = bind(); uid = null; assertNull(ownership.snapshot()); assertFalse(ownership.accepts(lease))
    }
    @Test fun anotherAccountCannotUseThePreviousDriverLease() {
        val lease = bind(); uid = "parent"; assertFalse(ownership.accepts(lease)); assertTrue(ownership.ownerChanged())
        uid = "driver"; assertFalse(ownership.accepts(lease)); assertNull(ownership.snapshot())
    }
    @Test fun logoutAndReloginToTheSameUidCannotReviveAnOldLeaseOrPendingIntent() {
        val lease = bind(); revision++; assertFalse(ownership.accepts(lease))
        assertNull(ownership.bind("driver", "ride", "driver", lease.authRevision))
        assertTrue(ownership.ownerChanged()); val resumed = bind(); assertNotSame(lease, resumed)
        assertTrue(ownership.accepts(resumed))
    }
    @Test fun replacingTheRideInvalidatesAlreadyQueuedBatches() {
        val previous = bind(); val next = bind("new-ride")
        assertFalse(ownership.accepts(previous)); assertTrue(ownership.accepts(next))
    }
    @Test fun clearingAServiceCannotBeUndoneByAnOldQueuedBatch() {
        val lease = bind(); ownership.clear(); assertNull(ownership.snapshot()); assertFalse(ownership.accepts(lease))
    }
    @Test fun noImplicitDriverOrAnonymousOrParentTrackingIsAccepted() {
        for (role in listOf(null, "", "parent", "admin")) assertNull(ownership.bind("driver", "ride", role, 0))
        assertNull(ownership.bind(null, "ride", "driver", 0)); assertNull(ownership.bind("driver", "", "driver", 0))
        assertNull(ownership.bind("other", "ride", "driver", 0)); assertFalse(ownership.ownerChanged())
    }
    @Test fun childTrackingStillRequiresItsOwnCurrentIdentity() {
        uid = "child"; val child = ownership.bind("child", "ride", "child", 0)
        assertNotNull(child); assertTrue(ownership.accepts(requireNotNull(child)))
        uid = "parent"; assertFalse(ownership.accepts(child))
    }
}
