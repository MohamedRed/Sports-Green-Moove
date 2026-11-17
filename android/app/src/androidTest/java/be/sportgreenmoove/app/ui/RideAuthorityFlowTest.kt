package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import be.sportgreenmoove.app.data.LiveRideSnapshot
import org.junit.Rule
import org.junit.Test

class RideAuthorityFlowTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun observersHaveStatusesWithoutDriverActions() {
        show(UiFlowFixtures.activeRide, canManageRide = false)
        for (tag in listOf(SgmTestTags.ActiveRidePickupAction, SgmTestTags.ActiveRideDropoffAction, SgmTestTags.ActiveRideEndAction)) {
            compose.onNodeWithTag(tag).assertDoesNotExist()
        }
        compose.onNodeWithTag(SgmTestTags.ActiveRideScreen).assertExists()
    }

    @Test
    fun driverCannotDropOffOrCompleteBeforePickup() {
        show(UiFlowFixtures.activeRide, canManageRide = true)
        compose.onNodeWithTag(SgmTestTags.ActiveRidePickupAction).assertIsEnabled()
        compose.onNodeWithTag(SgmTestTags.ActiveRideDropoffAction).assertIsNotEnabled()
        compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).assertIsNotEnabled()
    }

    @Test
    fun completedPassengerCannotBeConfirmedAgain() {
        show(UiFlowFixtures.activeRide.copy(passengers = UiFlowFixtures.activeRide.passengers.map {
            it.copy(pickupStatus = "pickedUp", dropoffStatus = "droppedOff")
        }), canManageRide = true)
        compose.onNodeWithTag(SgmTestTags.ActiveRidePickupAction).assertIsNotEnabled()
        compose.onNodeWithTag(SgmTestTags.ActiveRideDropoffAction).assertIsNotEnabled()
        compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).assertIsEnabled()
    }

    private fun show(ride: LiveRideSnapshot, canManageRide: Boolean) {
        compose.setSgmUiTestContent {
            RideMonitorScreen(activeRide = ride, canManageRide = canManageRide, routePreview = UiFlowFixtures.route,
                onBack = {}, onPickup = {}, onDropoff = {}, onEndRide = {}, onEmergencyContact = {})
        }
    }
}
