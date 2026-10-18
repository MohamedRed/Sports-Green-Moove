package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import java.io.File

class TripDraftPersistenceFlowTest {
    @get:Rule val compose = createComposeRule()
    private val uid = "draft-component-driver"
    private val tripId = "draft-component-trip"
    private val terms = TripChangeTerms("2099-12-01T10:00:00Z", null, MapPoint(50.71, 4.61), MapPoint(50.85, 4.35), 250)
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    @Before fun prepare() { SharedPreferencesTripChangeDrafts(context).write(uid, tripId, null) }
    @After fun clean() { SharedPreferencesTripChangeDrafts(context).write(uid, tripId, null) }

    @Test fun unfinishedFieldsSurviveClosingAndReopeningWithoutSubmitting() {
        var visible by mutableStateOf(true)
        var proposals = 0
        val gateway = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun previewTripChange(tripId: String) = TripChangePreview(tripId, "a".repeat(64), terms, 3, 2)
            override suspend fun proposeTripChange(request: TripChangeProposalRequest): TripChangeReview { proposals++; error("No submission expected") }
        }
        compose.setSgmUiTestContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, 2f)) {
                if (visible) TripChangeDialog(uid, AppRole.Driver, tripId, "Trajet du club", null, gateway, {}, { visible = false })
            }
        }
        waitFor("trip.change.price")
        enterTripFormText(compose, "trip.change.price", "4,")
        enterTripFormText(compose, "trip.change.origin.input", "Rue encore à choisir")
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithContentDescription("Fermer").performScrollTo().performClick()
        compose.waitUntil { compose.onAllNodesWithTag("trip.change.price").fetchSemanticsNodes().isEmpty() }
        compose.runOnIdle { visible = true }; waitFor("trip.change.price")
        compose.onNodeWithTag("trip.change.price").performScrollTo().assertTextContains("4,")
        compose.onNodeWithTag("trip.change.origin.input").performScrollTo().assertTextContains("Rue encore à choisir")
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
        assertEquals(0, proposals)
        captureLocalUi(compose, "trip-draft-restored-large-text.png", dialog = true)
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
        check(device.takeScreenshot(File(directory, "trip-draft-restored-large-text-window.png")))
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-trip-changes")
        for (name in listOf("trip-draft-restored-large-text.png", "trip-draft-restored-large-text-window.png")) {
            device.executeShellCommand("cp /sdcard/Android/data/${context.packageName}/files/local-ui-evidence/$name /sdcard/Download/sgm-trip-changes/$name")
        }
    }

    @Test fun privateStorageSurvivesNewInstanceWithoutPromotingUnresolvedLocation() {
        val draft = TripChangeDraft(terms).apply { price = ""; origin.edit("Adresse incomplète") }
        val record = TripChangeDraftRecord("a".repeat(64), terms, draft.snapshot(), null)
        SharedPreferencesTripChangeDrafts(context).write(uid, tripId, record)
        val next = SharedPreferencesTripChangeDrafts(context)
        assertEquals(record, next.read(uid, tripId)); assertNull(next.read("another-driver", tripId)); assertNull(next.read(uid, "another-trip"))
        assertNull(requireNotNull(next.read(uid, tripId)).input.origin.point)
        assertEquals("Adresse incomplète", next.read(uid, tripId)?.input?.origin?.input)
    }

    @Test fun codecRejectsCorruptForeignAndMalformedRecordsRatherThanErasingThem() {
        val draft = TripChangeDraft(terms)
        val request = TripChangeProposalRequest(tripId, "a".repeat(64), terms.copy(priceCents = 400))
        val record = TripChangeDraftRecord("a".repeat(64), terms, draft.snapshot(), request)
        val raw = TripChangeDraftCodec.encode(uid, tripId, record)
        assertEquals(record, TripChangeDraftCodec.decode(uid, tripId, raw))
        for (invalid in listOf("{", raw.replace("\"version\":1", "\"version\":2"), raw.replace(request.requestId, "not-a-uuid"),
            raw.replace("50.71", "150.71"), raw.replace("\"hasArrival\":false", "\"hasArrival\":\"false\""))) {
            assertThrows(Exception::class.java) { TripChangeDraftCodec.decode(uid, tripId, invalid) }
        }
        assertThrows(Exception::class.java) { TripChangeDraftCodec.decode("another-driver", tripId, raw) }
        assertThrows(Exception::class.java) { TripChangeDraftCodec.decode(uid, "another-trip", raw) }
    }

    private fun waitFor(tag: String) = compose.waitUntil(10_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
}
