package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.services.NotificationSettingsResult
import org.junit.Assert.*
import org.junit.Test

class NotificationSettingsStateTest {
    @Test fun blockedPermissionIsReadRatherThanAssumedAllowed() {
        var reads = 0
        val state = NotificationSettingsState({ reads++; false }, { error("No settings action requested") })
        assertFalse(state.allowed); assertEquals(1, reads); assertNull(state.error)
    }
    @Test fun allowedPermissionIsReadFromTheDevice() {
        val state = NotificationSettingsState({ true }, { error("No settings action requested") })
        assertTrue(state.allowed); assertNull(state.error)
    }
    @Test fun openingSettingsNeverOptimisticallyGrantsPermission() {
        var allowed = false; var reads = 0; var launches = 0
        val state = NotificationSettingsState({ reads++; allowed }, { launches++; NotificationSettingsResult.Opened })
        state.open(); assertFalse(state.allowed); assertEquals(1, launches); assertEquals(1, reads)
        allowed = true; state.refresh(); assertTrue(state.allowed); assertEquals(2, reads)
        allowed = false; state.refresh(); assertFalse(state.allowed); assertEquals(3, reads)
    }
    @Test fun missingSettingsActivityIsAnErrorWithoutAnotherLaunch() {
        var launches = 0
        val state = NotificationSettingsState({ false }, { launches++; NotificationSettingsResult.Unavailable })
        state.open(); assertFalse(state.allowed); assertEquals(1, launches)
        assertEquals("Les réglages de notifications sont indisponibles sur ce téléphone.", state.error)
    }
    @Test fun deniedSettingsActivityDoesNotChangePermission() {
        val state = NotificationSettingsState({ true }, { NotificationSettingsResult.Denied })
        state.open(); assertTrue(state.allowed)
        assertEquals("Impossible d’ouvrir les réglages de notifications.", state.error)
    }
    @Test fun anExplicitNewOpeningClearsItsPreviousError() {
        var result = NotificationSettingsResult.Unavailable; var launches = 0
        val state = NotificationSettingsState({ false }, { launches++; result })
        state.open(); assertNotNull(state.error)
        result = NotificationSettingsResult.Opened; state.open()
        assertNull(state.error); assertFalse(state.allowed); assertEquals(2, launches)
    }
    @Test fun returningFromSettingsReadsTheCurrentPermissionAndClearsTheOldError() {
        var allowed = true
        val state = NotificationSettingsState({ allowed }, { NotificationSettingsResult.Denied })
        state.open(); allowed = false; state.refresh()
        assertFalse(state.allowed); assertNull(state.error)
    }
}
