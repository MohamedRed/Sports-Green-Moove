package be.sportgreenmoove.app.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ChildEmergencyPermissionFlowTest {
    @get:Rule val compose = createComposeRule()
    private val ride = LiveRideSnapshot("ride", status = "Actif", vehicleLastUpdateLabel = "",
        childLastUpdateLabel = null, etaLabel = "Trajet en cours", stale = true)

    @Test fun deniedLocationDoesNotBlockTheDirectTripsContactOrStartTracking() {
        assertLocationDenied()
        val fixture = PermissionContactFixture(); var trackingStarts = 0
        compose.setSgmUiTestContent {
            var contact by remember { mutableStateOf(false) }
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                Box(Modifier.width(320.dp).testTag("emergency-permission.narrow")) {
                    if (contact) EmergencyContactRoute("child", setOf(AppRole.Child), fixture,
                        UnconfiguredGuardianVerificationGateway(), { contact = false },
                        rideSessionId = emergencyRideSessionId(setOf(AppRole.Child), ride, false),
                        launchDialer = { fixture.opens++; EmergencyDialerResult.Unavailable })
                    else TripsScreen(emptyList(), null, 0, {}, {}, { trackingStarts++ }, {},
                        onEmergencyContact = { contact = true })
                }
            }
        }
        compose.onNodeWithTag("trips.emergency").performScrollTo().assertIsEnabled().performClick()
        waitFor("emergency.child-ride.phone")
        compose.onNodeWithTag("emergency.child-ride.phone").performScrollTo().assertTextEquals("+12025550121")
        val bounds = compose.onNodeWithTag("emergency-permission.narrow").fetchSemanticsNode().boundsInRoot
        val button = compose.onNodeWithTag("emergency.child-ride.dial").performScrollTo().fetchSemanticsNode().boundsInRoot
        assertTrue(button.left >= bounds.left && button.right <= bounds.right)
        compose.onNodeWithTag("emergency.child-ride.dial").performClick(); waitFor("emergency.child-ride.error")
        assertEquals(1, fixture.opens); assertEquals(1, fixture.discoveries); assertEquals(0, trackingStarts); assertLocationDenied()
        compose.waitForIdle(); captureChildAccountWindow("child-emergency-location-denied-trips.png")
    }

    @Test fun childSettingsKeepTheActiveRideReadOnlyWithoutRequestingLocation() {
        assertLocationDenied()
        val fixture = PermissionContactFixture()
        val roles = setOf(AppRole.Child, AppRole.Parent)
        compose.setSgmUiTestContent {
            EmergencyContactRoute("child", roles, fixture, UnconfiguredGuardianVerificationGateway(), {},
                rideSessionId = emergencyRideSessionId(roles, ride, false))
        }
        waitFor("emergency.child-ride.phone")
        for (tag in listOf("emergency.name", "emergency.save", "emergency.remove")) compose.onNodeWithTag(tag).assertDoesNotExist()
        assertEquals(0, fixture.opens); assertLocationDenied()
        compose.waitForIdle(); captureChildAccountWindow("child-emergency-location-denied-settings.png")
    }

    private fun assertLocationDenied() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        for (permission in listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION)) assertEquals("This case requires denied location: $permission",
            PackageManager.PERMISSION_DENIED, context.checkSelfPermission(permission))
    }
    private fun waitFor(tag: String) { compose.waitUntil(30_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() } }
}

private class PermissionContactFixture : EmergencyContactGateway {
    var discoveries = 0
    override suspend fun discoverChildRideEmergencyContact(uid: String): ChildRideEmergencyContactView? {
        discoveries++; return readChildRideEmergencyContact(uid, "ride")
    }
    var opens = 0
    override suspend fun readChildRideEmergencyContact(uid: String, rideSessionId: String): ChildRideEmergencyContactView {
        check(uid == "child" && rideSessionId == "ride")
        return ChildRideEmergencyContactView(uid, rideSessionId, "profile", "a".repeat(64), "Enfant fictif QA",
            PersonalEmergencyContact("Contact fictif QA", "+12025550121"), 1)
    }
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView = error("No adult contact access")
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt = error("No child editing")
}
