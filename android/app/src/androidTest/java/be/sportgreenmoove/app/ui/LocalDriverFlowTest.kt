package be.sportgreenmoove.app.ui

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
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalDriverFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()

    @Test
    fun driverApprovesPendingBookingAndSignsOut() {
        assumeTrue(BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        AndroidRuntime.create(context).auth.signOut()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        ActivityScenario.launch(MainActivity::class.java).use {
            waitFor(SgmTestTags.AuthEmailAction)
            compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(session.getString("driver"))
            compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(session.getString("password"))
            compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
            waitFor(SgmTestTags.HomeScreen)
            compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
            compose.onNodeWithText("RÉSERVATIONS").performClick()
            val approve = "${SgmTestTags.BookingApproveAction}.sgm-qa-booking-requested"
            compose.waitUntil(60_000) {
                runCatching { compose.onNodeWithTag(approve).assertIsEnabled() }.isSuccess
            }
            compose.onNodeWithTag(approve).performScrollTo().assertIsDisplayed().assertIsEnabled().performClick()
            waitFor("bookings.confirm")
            compose.onNodeWithTag("bookings.confirm").assertIsDisplayed().performClick()
            compose.waitUntil(60_000) {
                compose.onAllNodesWithTag(approve).fetchSemanticsNodes().isEmpty() &&
                    runCatching {
                        compose.onNodeWithTag("reservation.status.sgm-qa-booking-requested").assertTextEquals("Approuvée")
                    }.isSuccess
            }
            captureLocalUi(compose, "local-driver-booking-approved.png")
            compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
            waitFor(SgmTestTags.AuthEmailAction)
            captureLocalUi(compose, "local-driver-signed-out.png")
        }
    }

    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }
}
