package be.sportgreenmoove.app.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.BuildConfig
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.StandardTestDispatcher
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalBookingResponseLossUiTest {
    @get:Rule val compose = createComposeRule(effectContext = StandardTestDispatcher())
    private lateinit var controller: SearchController

    @Test fun theParentRetriesALostReplyAndTheConfirmedResultHasNoSecondSubmissionAction() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val fixture = runBlocking { LocalBookingUiFixture.open(context) }
        val error = mutableStateOf<String?>(null)
        val notices = mutableListOf<String>()
        val result = JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", fixture.session.getString("runId"))
            .put("scope", "native-search-ui-with-real-booking-sdk-and-stubbed-matching")
            .put("tripId", fixture.trip.id).put("completed", false)
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
        fun writeResult() = File(directory, "local-booking-ui-loss.json").writeText(result.toString(2))
        var phase = "host"
        try {
            assertNull(fixture.storage.read(fixture.slot))
            compose.setSgmUiTestContent {
                controller = rememberSearchController(fixture.providers, rememberCoroutineScope(), fixture.slot.uid,
                    { error.value = it }, { notices += it }, {})
                SearchRoute(controller, fixture.children, error.value, {})
            }
            compose.runOnIdle {
                controller.selectPlace(suggestion("origin"), SearchPlaceTarget.Origin)
                controller.selectPlace(suggestion("destination"), SearchPlaceTarget.Destination)
            }
            compose.waitUntil(30_000) { controller.origin != null && controller.destination != null }
            compose.runOnIdle {
                controller.updateForm(controller.form.copy(desiredDepartureAtIso = checkNotNull(fixture.trip.bookingIntent).departureAt,
                    childUserId = fixture.slot.childId, seatsNeeded = 2, requireChildTracking = false))
                controller.updateForm(controller.form.copy(guardianConsent = true))
            }
            compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
            compose.waitUntil(30_000) { controller.hasSearched && controller.matches.size == 1 }
            val displayed = controller.matches.single()
            phase = "sending"
            compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performScrollTo().performClick()
            compose.waitUntil(30_000) { fixture.calls.get() == 1 && controller.bookingTripId == fixture.trip.id }
            compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertIsNotEnabled()
            compose.onNodeWithText("ENVOI EN COURS").assertIsDisplayed()
            result.put("sendingObservedBeforeDispatch", true)
            captureLocalUi(compose, "local-booking-ui-sending.png")
            fixture.sendGate.complete(Unit)
            phase = "unconfirmed"
            compose.waitUntil(90_000) { error.value != null && controller.bookingTripId == null }
            compose.runOnIdle { assertTrue(notices.isEmpty()) }
            compose.onNodeWithText("Demande non confirmée. Réessayez pour vérifier son envoi.").performScrollTo().assertIsDisplayed()
            compose.onNodeWithTag(SgmTestTags.BookingRequestConfirmed).assertDoesNotExist()
            compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performScrollTo().assertIsEnabled()
            compose.onNodeWithText("RÉESSAYER").assertIsDisplayed()
            val pending = checkNotNull(fixture.storage.read(fixture.slot))
            result.put("clientRequestId", pending.requestId).put("unconfirmedReplyVisible", true)
                .put("retryActionVisible", true).put("pendingIdentityPersisted", true)
            captureLocalUi(compose, "local-booking-ui-unconfirmed.png")
            phase = "retry"
            compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performClick()
            compose.waitUntil(90_000) { fixture.trip.id in controller.confirmedBookingTripIds && controller.bookingTripId == null }
            compose.onNodeWithTag(SgmTestTags.BookingRequestConfirmed).performScrollTo().assertIsDisplayed()
            compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertDoesNotExist()
            compose.runOnIdle {
                assertEquals(listOf("Demande envoyée."), notices)
                controller.requestMatch(displayed)
                assertEquals(2, fixture.calls.get())
            }
            assertNull(fixture.storage.read(fixture.slot))
            result.put("confirmedVisible", true).put("secondSubmissionActionAbsent", true)
                .put("staleCallbackIgnored", true).put("sdkCalls", fixture.calls.get())
                .put("bookingId", checkNotNull(fixture.acknowledgedBookingId.get()))
                .put("pendingClearedAfterAcknowledgement", true).put("completed", true)
            captureLocalUi(compose, "local-booking-ui-confirmed.png")
            writeResult()
        } catch (failure: Throwable) {
            result.put("completed", false).put("failedPhase", phase); writeResult(); throw failure
        } finally {
            if (::controller.isInitialized) compose.runOnIdle { controller.close() }
            fixture.close()
        }
    }

    private fun suggestion(id: String) = be.sportgreenmoove.app.data.PlaceSuggestion(id, id, id, null)
}
