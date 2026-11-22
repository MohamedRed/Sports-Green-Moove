package be.sportgreenmoove.app.ui

import android.app.ActivityManager
import android.content.Context
import android.content.pm.ActivityInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.ActiveRideLocationService
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.Locale

class LocalRideFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()

    @Test
    fun driverCompletesRideAndParentSubmitsReview() {
        assumeTrue(BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        LocalMockLocation(context).use { location ->
            ActivityScenario.launch(MainActivity::class.java).use { activity ->
                activity.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
                login(session.getString("driver"), session.getString("password"))
                waitForText("U 7/8 · Green Wavre QA Club")
                location.emit()
                compose.onNodeWithTag(SgmTestTags.HomeRideAction).performClick()
                waitFor(SgmTestTags.ActiveRideScreen)
                val expectedRide = runBlocking { runtime.firebase.getActiveRide() } ?: error("Expected active fixture ride")
                val contacts = LocalRideEmergencyUi(compose, runtime, session.getString("runId")) { locationServiceRunning(context) }
                val driverContact = contacts.verify("driver", "+12025550125", "+12025550126", expectedRide)
                logout(); login(session.getString("parent"), session.getString("password"))
                openActiveRide()
                val parentContact = contacts.verify("parent", "+12025550126", "+12025550125", expectedRide)
                logout(); login(session.getString("driver"), session.getString("password"))
                location.emit(); openActiveRide()
                val resumedTracking = contacts.assertTracking("driver", "resumed")
                writeRideEmergencyEvidence(context, session.getString("runId"), listOf(driverContact, parentContact), resumedTracking)
                compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).assertIsNotEnabled()
                repeat(2) { index ->
                    compose.onAllNodesWithTag(SgmTestTags.ActiveRideDropoffAction)[index].assertIsNotEnabled()
                    compose.onAllNodesWithTag(SgmTestTags.ActiveRidePickupAction)[index].performScrollTo().performClick()
                    compose.waitUntil(60_000) {
                        compose.onAllNodesWithText("Prise en charge validée", substring = true).fetchSemanticsNodes().size == index + 1
                    }
                }
                repeat(2) { index ->
                    compose.onAllNodesWithTag(SgmTestTags.ActiveRideDropoffAction)[index].performScrollTo().performClick()
                    compose.waitUntil(60_000) {
                        compose.onAllNodesWithText("Dépose validée", substring = true).fetchSemanticsNodes().size == index + 1
                    }
                }
                compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).performScrollTo().assertIsEnabled()
                captureLocalUi(compose, "local-ride-passengers-delivered.png")
                compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).performClick()
                waitForText("Course terminée", substring = true)
                compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).assertDoesNotExist()
                compose.waitUntil(15_000) { !locationServiceRunning(context) }
                compose.onNodeWithTag(SgmTestTags.BottomNavHomeAction).performClick()
                compose.onNodeWithTag(SgmTestTags.HomeImpactAction).performScrollTo().performClick()
                waitFor(SgmTestTags.ImpactScreen)
                waitForText("1 trajets")
                compose.onNodeWithText("1 trajets").assertIsDisplayed()
                captureLocalUi(compose, "local-ride-impact.png")
                compose.onNodeWithTag(SgmTestTags.BackAction).performScrollTo().performClick()
                compose.onNodeWithText("RÉCOMPENSES").performScrollTo().performClick()
                waitFor(SgmTestTags.RewardsScreen)
                val reward = runBlocking { runtime.firebase.getRewardSummary() }
                assertTrue(reward.balanceCents > 250)
                val amount = String.format(Locale.FRANCE, "%d,%02d", reward.balanceCents / 100, reward.balanceCents % 100)
                waitForText(amount)
                compose.onNodeWithText(amount).assertIsDisplayed()
                captureLocalUi(compose, "local-ride-rewards.png")
                compose.onNodeWithTag(SgmTestTags.BackAction).performScrollTo().performClick()
                logout()
                login(session.getString("parent"), session.getString("password"))
                compose.onNodeWithText("Course terminée", substring = true).assertDoesNotExist()
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                compose.onNodeWithText("PASSÉS").performClick()
                val trip = runBlocking { runtime.firebase.searchTrips() }.single { it.id == "sgm-qa-trip-u8-wavre-bruxelles" }
                selectLocalTripMonth(compose, trip)
                waitForText("U 7/8 · Green Wavre QA Club")
                captureLocalUi(compose, "local-ride-parent-history.png")
                compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
                waitFor(SgmTestTags.MessagesScreen)
                compose.onNodeWithTag(SgmTestTags.RatingTab).performClick()
                waitFor(SgmTestTags.RatingPromptAction)
                captureLocalUi(compose, "local-ride-review-prompt.png")
                compose.onNodeWithTag("${SgmTestTags.RatingPromptAction}.5").performScrollTo().performClick()
                waitForText("Avis envoyé.")
                compose.onNodeWithTag(SgmTestTags.RatingPromptAction).assertDoesNotExist()
                compose.onNodeWithText("Aucun avis en attente.").assertIsDisplayed()
                captureLocalUi(compose, "local-ride-review-sent.png")
            }
        }
    }

    private fun login(email: String, password: String) {
        waitFor(SgmTestTags.AuthEmailAction)
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(email)
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(password)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(SgmTestTags.HomeScreen)
    }

    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailAction)
    }

    private fun openActiveRide() {
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(SgmTestTags.ActiveRideResumeAction).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).performScrollTo().assertIsEnabled().performClick()
        waitFor(SgmTestTags.ActiveRideScreen)
    }

    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }

    private fun waitForText(text: String, substring: Boolean = false) {
        compose.waitUntil(60_000) { compose.onAllNodesWithText(text, substring = substring).fetchSemanticsNodes().isNotEmpty() }
    }

    @Suppress("DEPRECATION")
    private fun locationServiceRunning(context: Context): Boolean =
        (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getRunningServices(50)
            .any { it.service.className == ActiveRideLocationService::class.java.name }
}
