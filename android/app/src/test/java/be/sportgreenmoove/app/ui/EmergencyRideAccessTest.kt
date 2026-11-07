package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import org.junit.Assert.*
import org.junit.Test

class EmergencyRideAccessTest {
    private val ride = LiveRideSnapshot("ride", status = "Actif", vehicleLastUpdateLabel = "",
        childLastUpdateLabel = null, etaLabel = "", stale = true)

    @Test fun childCanReadFromSettingsOrTripsWithoutEnteringTheTrackingPermissionGate() {
        for (fromRide in listOf(false, true))
            assertEquals("ride", emergencyRideSessionId(setOf(AppRole.Child), ride, fromRide))
    }
    @Test fun mixedRoleCannotSwitchToTheAdultContactEditor() {
        assertEquals("ride", emergencyRideSessionId(setOf(AppRole.Child, AppRole.Parent), ride, false))
    }
    @Test fun noRideNeverBecomesAGuessedOrPreviousRide() {
        assertNull(emergencyRideSessionId(setOf(AppRole.Child), null, true))
        assertNull(emergencyRideSessionId(setOf(AppRole.Child), null, false))
    }
    @Test fun adultSettingsRemainIndependentOfTheRide() {
        assertNull(emergencyRideSessionId(setOf(AppRole.Parent), ride, false))
        assertEquals("ride", emergencyRideSessionId(setOf(AppRole.Parent), ride, true))
    }
}
