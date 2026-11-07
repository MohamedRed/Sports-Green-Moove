package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.LiveRideSnapshot
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RideAccessPolicyTest {
    private val driver = AuthSession("driver-1", null, null, setOf(AppRole.Driver, AppRole.Parent))
    private val ride = LiveRideSnapshot("ride-1", driverUserId = "driver-1", status = "active",
        vehicleLastUpdateLabel = "", childLastUpdateLabel = null, etaLabel = "", stale = true)

    @Test
    fun onlyTheAuthenticatedOwnerInDriverModeHasControls() {
        assertTrue(canManageRide(AppRole.Driver, driver, ride))
        assertFalse(canManageRide(AppRole.Parent, driver, ride))
        assertFalse(canManageRide(AppRole.Driver, driver.copy(uid = "other-driver"), ride))
        assertFalse(canManageRide(AppRole.Driver, driver.copy(roles = setOf(AppRole.Parent)), ride))
        assertFalse(canManageRide(AppRole.Driver, driver, ride.copy(driverUserId = null)))
        assertFalse(canManageRide(AppRole.Driver, null, ride))
        assertFalse(canManageRide(AppRole.Driver, driver, null))
    }
}
