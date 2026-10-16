package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.services.AndroidRuntime
import be.sportgreenmoove.app.services.ReservationGateway
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalBookingDecisionsFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private lateinit var session: JSONObject
    private lateinit var gateway: ReservationGateway

    @Test fun parentCancelsPendingAndApprovedAndDriverDeclinesWithConfirmation() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        gateway = runtime.reservations
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        ActivityScenario.launch(MainActivity::class.java).use {
            login("parent")
            reservations()
            val pending = bookingId("Trajet QA annulation demandée", AppRole.Parent)
            val approved = bookingId("Trajet QA annulation approuvée", AppRole.Parent)
            val decline = bookingId("Trajet QA à refuser", AppRole.Parent)
            val cancelTag = decisionTag(ReservationDecision.Cancel, pending)
            waitForEnabled(cancelTag)
            compose.onNodeWithTag(cancelTag).performScrollTo().performClick()
            waitFor("bookings.keep")
            compose.onNodeWithTag("bookings.keep").assertIsDisplayed().performClick()
            assertEquals("requested", runBlocking { gateway.list(AppRole.Parent).items.single { it.booking.bookingId == pending }.booking.status })
            decide(pending, ReservationDecision.Cancel, "Annulée")
            decide(approved, ReservationDecision.Cancel, "Annulée")
            compose.onNodeWithTag("reservation.status.$approved").performScrollTo().assertTextEquals("Annulée")
            captureLocalUi(compose, "local-parent-reservations-cancelled.png")
            logout()
            login("driver")
            reservations()
            decide(decline, ReservationDecision.Decline, "Refusée")
            compose.onNodeWithTag(decisionTag(ReservationDecision.Approve, decline)).assertDoesNotExist()
            compose.onNodeWithTag("reservation.status.$decline").performScrollTo().assertTextEquals("Refusée")
            captureLocalUi(compose, "local-driver-reservation-declined.png")
            logout()
            login("parent")
            reservations()
            waitFor("reservation.status.$decline")
            compose.onNodeWithTag("reservation.status.$decline").assertTextEquals("Refusée")
            compose.onNodeWithTag(decisionTag(ReservationDecision.Cancel, decline)).assertDoesNotExist()
        }
    }
    private fun bookingId(title: String, role: AppRole) = runBlocking {
        gateway.list(role).items.single { it.booking.title == title }.booking.bookingId
    }
    private fun decide(id: String, decision: ReservationDecision, status: String) {
        val tag = decisionTag(decision, id)
        waitForEnabled(tag)
        compose.onNodeWithTag(tag).performScrollTo().assertIsDisplayed().performClick()
        waitFor("bookings.confirm")
        compose.onNodeWithTag("bookings.confirm").assertIsDisplayed().performClick()
        compose.waitUntil(60_000) {
            runCatching { compose.onNodeWithTag("reservation.status.$id").assertTextEquals(status) }.isSuccess
        }
        compose.onNodeWithTag(tag).assertDoesNotExist()
    }
    private fun reservations() {
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        compose.onNodeWithText("RÉSERVATIONS").performClick()
        waitFor("bookings.refresh")
    }
    private fun login(actor: String) {
        waitFor(SgmTestTags.AuthEmailAction)
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(session.getString(actor))
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(session.getString("password"))
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(SgmTestTags.HomeScreen)
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailAction)
    }
    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun waitForEnabled(tag: String) {
        compose.waitUntil(60_000) {
            runCatching { compose.onNodeWithTag(tag).assertIsEnabled() }.isSuccess
        }
    }
}
