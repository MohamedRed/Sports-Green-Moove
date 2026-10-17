package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.domain.BookingReviewRequiredException
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredAuthGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class BookingReviewFlowTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var controller: SearchController
    private val error = mutableStateOf<String?>(null)
    private var requests = 0
    private var searches = 0
    private val reviewMessage = "Les détails du trajet ont changé. Relancez la recherche avant de réserver."

    @Test fun aChangedTripRemovesTheOldActionUntilAFreshSearch() {
        host()
        ready()
        val previous = controller.matches.single()
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performScrollTo().performClick()
        waitForFailure()
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertDoesNotExist()
        compose.onNodeWithText("private-provider-detail", substring = true).assertDoesNotExist()
        capture("booking-review-required.png")
        compose.runOnIdle { controller.requestMatch(previous); assertEquals(1, requests) }
        compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().assertIsDisplayed().performClick()
        compose.waitUntil(5_000) { controller.hasSearched && controller.matches.isNotEmpty() }
        compose.runOnIdle { assertEquals(2, searches); assertEquals(1, requests) }
    }

    @Test fun narrowLargeTextKeepsTheReviewMessageAndSearchActionInsideTheScreen() {
        host(narrow = true)
        ready()
        compose.runOnIdle { controller.requestMatch(controller.matches.single()) }
        waitForFailure()
        val host = compose.onNodeWithTag("booking.review.host").fetchSemanticsNode().boundsInRoot
        for (node in listOf(compose.onNodeWithText(reviewMessage), compose.onNodeWithTag(SgmTestTags.SearchAction))) {
            val bounds = node.performScrollTo().assertIsDisplayed().fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= host.left && bounds.right <= host.right)
        }
        capture("booking-review-narrow.png")
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertDoesNotExist()
    }

    @Test fun anUnrelatedFailureDoesNotPretendTheTripChanged() {
        host(changed = false)
        ready()
        compose.runOnIdle { controller.requestMatch(controller.matches.single()) }
        compose.waitUntil(5_000) { error.value != null }
        compose.onNodeWithText(reviewMessage).assertDoesNotExist()
        compose.runOnIdle { assertTrue(controller.hasSearched); assertEquals(1, controller.matches.size); assertEquals(1, requests) }
    }

    private fun host(narrow: Boolean = false, changed: Boolean = true) {
        val gateway = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun resolvePlace(placeId: String) = UiFlowFixtures.origin.copy(placeId = placeId, label = placeId)
            override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<be.sportgreenmoove.app.data.TripMatchSummary> {
                searches++
                return listOf(UiFlowFixtures.match.copy(summary = UiFlowFixtures.match.summary.copy(seatsAvailable = 4)))
            }
            override suspend fun requestBooking(tripId: String, childId: String?, seats: Int): String {
                requests++
                if (changed) throw BookingReviewRequiredException(IllegalStateException("private-provider-detail"))
                throw IllegalStateException("network unavailable")
            }
        }
        val providers = AndroidProviderSet(UnconfiguredAuthGateway(), gateway)
        compose.setSgmUiTestContent {
            controller = rememberSearchController(providers, rememberCoroutineScope(), "booking-review-parent", { error.value = it }, {}, {})
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, if (narrow) 1.5f else density.fontScale)) {
                Box((if (narrow) Modifier.width(320.dp) else Modifier).testTag("booking.review.host")) {
                    SearchRoute(controller, emptyList(), error.value, {})
                }
            }
        }
    }

    private fun ready() {
        compose.runOnIdle {
            controller.selectPlace(PlaceSuggestion("Départ QA", "Départ QA", "Départ QA", null), SearchPlaceTarget.Origin)
            controller.selectPlace(PlaceSuggestion("Arrivée QA", "Arrivée QA", "Arrivée QA", null), SearchPlaceTarget.Destination)
        }
        compose.waitUntil(5_000) { controller.origin != null && controller.destination != null }
        compose.runOnIdle {
            controller.updateForm(controller.form.copy(requireChildTracking = false))
            controller.updateForm(controller.form.copy(guardianConsent = true))
        }
        compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
        compose.waitUntil(5_000) { controller.hasSearched && controller.matches.isNotEmpty() }
    }

    private fun waitForFailure() {
        compose.waitUntil(5_000) { error.value == reviewMessage && !controller.hasSearched && controller.matches.isEmpty() }
        compose.onNodeWithText(reviewMessage).performScrollTo().assertIsDisplayed()
    }

    private fun capture(name: String) {
        captureLocalUi(compose, name)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-booking-review")
        device.executeShellCommand("cp /sdcard/Android/data/${instrumentation.targetContext.packageName}/files/local-ui-evidence/$name /sdcard/Download/sgm-booking-review/$name")
    }
}
