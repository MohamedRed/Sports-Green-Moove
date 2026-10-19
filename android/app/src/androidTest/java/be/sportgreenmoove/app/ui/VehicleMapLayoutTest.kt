package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.data.LiveRideSnapshot
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class VehicleMapLayoutTest {
    @get:Rule val compose = createComposeRule()
    @Test fun theArrivalEstimateStaysOutsideTheMapOnANarrowLargeTextScreen() {
        host(UiFlowFixtures.activeRide.copy(etaLabel = "ETA à calculer"), narrow = true)
        inspectArrival("ETA à calculer", "narrow")
    }
    @Test fun aStaleObservationStillShowsItsArrivalEstimateBelowTheMap() {
        host(UiFlowFixtures.activeRide.copy(stale = true, etaLabel = "ETA 12 min"), narrow = false)
        compose.onNodeWithTag(SgmTestTags.ActiveRideStaleWarning).performScrollTo().assertIsDisplayed()
        inspectArrival("ETA 12 min", "stale")
    }
    private fun host(ride: LiveRideSnapshot, narrow: Boolean) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assumeTrue(context.getString(R.string.sgm_google_maps_android_api_key).isBlank())
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, if (narrow) 1.3f else 1.0f)) {
                Box(Modifier.width(if (narrow) 320.dp else 411.dp).testTag("vehicle-map.layout")) {
                    RideMonitorScreen(ride, false, UiFlowFixtures.route, {}, {}, {}, {}, {})
                }
            }
        }
    }
    private fun inspectArrival(value: String, capture: String) {
        compose.onNodeWithText("SUIVI EN DIRECT").assertDoesNotExist()
        compose.onNodeWithText(value).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Arrivée estimée").assertIsDisplayed()
        val frame = compose.onNodeWithTag("vehicle-map.layout").fetchSemanticsNode().boundsInRoot
        val map = compose.onNodeWithTag(SgmTestTags.GoogleMapsRoutePreview).fetchSemanticsNode().boundsInRoot
        for (text in listOf(value, "Arrivée estimée")) {
            val bounds = compose.onNodeWithText(text).fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= frame.left && bounds.right <= frame.right)
            assertTrue("The arrival estimate must not cover the map", bounds.top >= map.bottom)
        }
        captureNativeStartupWindow(compose, "local-native-startup-vehicle-map-$capture.png")
        val directory = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "local-ui-evidence")
        File(directory, "vehicle-map-layout-$capture.json").writeText(JSONObject()
            .put("scope", "native-component-layout-without-map-renderer-or-backend")
            .put("arrivalOutsideMap", true).put("textWithinViewport", true).put("mapSdkVerified", false)
            .put("physicalDevice", false).toString(2))
    }
}
