package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import com.google.firebase.auth.FirebaseAuth
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class LiveBackendAuthFlowTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    @Before
    fun requireLiveBackendFlag() {
        assumeTrue("Live backend UI smoke is only enabled for BrowserStack release evidence runs.", BuildConfig.SGM_LIVE_BACKEND_UI_TEST)
        FirebaseAuth.getInstance().signOut()
    }

    @Test
    fun disposableEmailSignupReachesAuthenticatedHome() {
        val email = "sgm-browserstack-${System.currentTimeMillis()}@example.com"
        val password = "BrowserStack123!"

        waitUntilTagExists(SgmTestTags.AuthScreen)
        compose.onNodeWithText("S'INSCRIRE").performClick()
        compose.onNodeWithTag(SgmTestTags.AuthNameInput).performTextInput("BrowserStack Parent")
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performTextInput(email)
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performTextInput(password)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performClick()

        waitUntilTagExists(SgmTestTags.HomeScreen, timeoutMillis = 45_000)
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).assertExists()
        compose.onNodeWithTag(SgmTestTags.BottomNavPublishAction).assertExists()
        compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).assertExists()
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).assertExists()
    }

    private fun waitUntilTagExists(tag: String, timeoutMillis: Long = 10_000) {
        compose.waitUntil(timeoutMillis = timeoutMillis) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }
}