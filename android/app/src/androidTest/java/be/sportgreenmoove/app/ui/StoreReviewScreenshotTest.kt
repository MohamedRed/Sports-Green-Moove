package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class StoreReviewScreenshotTest {
    @get:Rule
    val compose = createComposeRule()

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val device = UiDevice.getInstance(instrumentation)
    private val screenshotDir = "/sdcard/Download/sgm-store-review"

    @Before
    fun prepareScreenshots() {
        device.executeShellCommand("rm -rf $screenshotDir")
        device.executeShellCommand("mkdir -p $screenshotDir")
    }

    @Test
    fun capturesStoreReviewUserFlowScreenshots() {
        val host = setSwitchableTestContent {
            RideMonitorScreen(
                activeRide = UiFlowFixtures.activeRide,
                routePreview = UiFlowFixtures.route,
                onBack = {},
                onPickup = {},
                onDropoff = {},
                onEndRide = {},
            )
        }
        compose.onNodeWithTag(SgmTestTags.ActiveRideScreen).assertIsDisplayed()
        capture("store-active-ride-tracking.png")

        compose.onNodeWithTag(SgmTestTags.GoogleMapsRoutePreview).assertExists()
        capture("store-google-maps-route-preview.png")

        host.show {
            RideMonitorScreen(
                activeRide = UiFlowFixtures.activeRide.copy(
                    vehicleLastUpdateLabel = "Position GPS perdue depuis 12 min",
                    childLastUpdateLabel = "Secours GPS à vérifier",
                    stale = true,
                ),
                routePreview = UiFlowFixtures.route,
                onBack = {},
                onPickup = {},
                onDropoff = {},
                onEndRide = {},
            )
        }
        compose.onNodeWithTag(SgmTestTags.ActiveRideStaleWarning).assertIsDisplayed()
        capture("store-stale-location-warning.png")

        host.show {
            RideMonitorScreen(
                activeRide = UiFlowFixtures.activeRide,
                routePreview = UiFlowFixtures.route,
                onBack = {},
                onPickup = {},
                onDropoff = {},
                onEndRide = {},
            )
        }
        compose.onNodeWithTag(SgmTestTags.EmergencyContact).performScrollTo().assertIsDisplayed()
        capture("store-emergency-contact-action.png")

        host.show {
            PermissionEducationFixture()
        }
        compose.onNodeWithText("Suivi de course").assertIsDisplayed()
        compose.onNodeWithText("Continuer").assertIsDisplayed()
        capture("store-permission-education.png")
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        val output = "$screenshotDir/$name"
        device.executeShellCommand("screencap -p $output")
        assertTrue(
            "$name is empty",
            device.executeShellCommand("test -s $output && echo ok").trim() == "ok",
        )
    }

    private fun setSwitchableTestContent(content: @Composable () -> Unit): TestContentHost {
        val activeContent = mutableStateOf<@Composable () -> Unit>(content)
        compose.setSgmUiTestContent {
            activeContent.value()
        }
        return TestContentHost(activeContent)
    }

    private inner class TestContentHost(
        private val activeContent: MutableState<@Composable () -> Unit>,
    ) {
        fun show(content: @Composable () -> Unit) {
            compose.runOnIdle {
                activeContent.value = content
            }
            compose.waitForIdle()
        }
    }
}

@Composable
private fun PermissionEducationFixture() {
    val gate = rememberActiveRidePermissionGate(onBlocked = {})
    LaunchedEffect(Unit) {
        gate.runWhenReady {}
    }
}
