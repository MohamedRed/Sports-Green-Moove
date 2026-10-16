package be.sportgreenmoove.app.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.test.filters.SdkSuppress
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.IOException

@SdkSuppress(minSdkVersion = 29)
class TripCancellationFlowTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val trip = UiFlowFixtures.trip.copy(driverUserId = "driver")
    private class Gateway : FirebaseGateway by UnconfiguredFirebaseGateway() {
        val requests = mutableListOf<TripCancellationRequest>()
        var fail = false
        var receipt: TripCancellationReceipt? = null
        override suspend fun previewTripCancellation(tripId: String): TripCancellationPreview =
            receipt ?: TripCancellationReady(tripId, "a".repeat(64), 2, 1)
        override suspend fun cancelTrip(request: TripCancellationRequest): TripCancellationReceipt {
            requests += request
            val result = TripCancellationReceipt(request.tripId, request.requestId, request.expectedRevision, request.reason,
                "driver", "2026-10-16T12:00:00Z", listOf("paid", "pending"), 1, 3)
            receipt = result
            if (fail) throw IOException()
            return result
        }
    }

    @Test fun onlyTheOwningDriverCanOpenCancellationAndItDoesNotStartARide() {
        var role by mutableStateOf(AppRole.Parent)
        var uid by mutableStateOf("driver")
        var active by mutableStateOf<LiveRideSnapshot?>(null)
        var starts = 0
        val gateway = Gateway()
        compose.setSgmUiTestContent {
            TripsRoute(uid, role, gateway, listOf(trip), active, 0, { starts++ }, {}, {}, {}, {})
        }
        compose.onNodeWithTag("trip.cancel.${trip.id}").assertDoesNotExist()
        compose.runOnIdle { role = AppRole.Driver; uid = "other" }
        compose.onNodeWithTag("trip.cancel.${trip.id}").assertDoesNotExist()
        compose.runOnIdle { uid = "driver"; active = UiFlowFixtures.activeRide }
        compose.onNodeWithTag("trip.cancel.${trip.id}").assertDoesNotExist()
        compose.runOnIdle { active = null }
        compose.onNodeWithTag("trip.cancel.${trip.id}").performScrollTo().performClick()
        waitFor("trip.cancel.reason")
        compose.onNodeWithTag("trip.cancel.count").assertTextEquals("2 réservations concernées.")
        compose.onNodeWithTag("trip.cancel.keep").performClick()
        assertEquals(0, starts)
        assertTrue(gateway.requests.isEmpty())
        compose.onNodeWithTag("trip.cancel.${trip.id}").performScrollTo().performClick()
        waitFor("trip.cancel.reason")
        compose.runOnIdle { role = AppRole.Parent }
        compose.onNodeWithTag("trip.cancel.reason").assertDoesNotExist()
    }

    @Test fun largeTextConfirmationRecoversUnknownOutcomeWithNoSecondWrite() {
        val gateway = Gateway().apply { fail = true }
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.6f)) {
                TripCancellationDialog("driver", AppRole.Driver, trip, gateway, {}, {})
            }
        }
        waitFor("trip.cancel.reason")
        compose.onNodeWithTag("trip.cancel.confirm").assertIsNotEnabled()
        enterCancellationReason(compose, "Match reporté")
        compose.onNodeWithTag("trip.cancel.confirm").assertIsDisplayed().performClick()
        waitFor("trip.cancel.refresh")
        compose.onNodeWithTag("trip.cancel.reason").assertIsNotEnabled()
        compose.onNodeWithTag("trip.cancel.refresh").assertIsDisplayed().performClick()
        waitFor("trip.cancel.recorded")
        compose.onNodeWithTag("trip.cancel.title").assertTextEquals("Trajet annulé")
        compose.onNodeWithTag("trip.cancel.recorded").performScrollTo().assertTextEquals("Match reporté")
        compose.onNodeWithTag("trip.cancel.confirm").assertDoesNotExist()
        assertEquals(1, gateway.requests.size)
    }
    private fun waitFor(tag: String) = compose.waitUntil(5_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
}
