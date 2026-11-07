package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalMembershipFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val approved = "sgm-qa-native-approve"
    private val rejected = "sgm-qa-native-reject"

    @Test fun requestDecisionRefreshRerequestRestartAndAnotherAccount() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        AndroidRuntime.create(context).auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            login(session.getString("parent"), session.getString("password"))
            openGroups()
            join(approved)
            pending(approved)
            join(rejected)
            pending(rejected)
            runBlocking { LocalMembershipReviewer.open(context, session) }.use { reviewer ->
                runBlocking {
                    reviewer.review(approved, "approve")
                    reviewer.review(rejected, "reject")
                }
                pending(approved)
                refresh()
                member(approved)
                waitFor(hasText("Refusée") and hasAnyAncestor(hasTestTag("groups.discovery.$rejected")))
                compose.onNodeWithTag("groups.discovery.$rejected").performScrollTo().assertIsDisplayed()
                captureLocalUi(compose, "local-membership-approved-refused.png")
                join(rejected)
                pending(rejected)
                runBlocking { reviewer.review(rejected, "approve") }
                refresh()
                member(approved)
                member(rejected)
            }
            activity.recreate()
            member(approved)
            member(rejected)
            captureLocalUi(compose, "local-membership-after-restart.png")
            compose.onNodeWithTag(SgmTestTags.BackAction).performScrollTo().performClick()
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
            login(session.getString("driver"), session.getString("password"))
            openGroups()
            waitFor(hasTestTag("groups.discovery.$approved"))
            waitFor(hasTestTag("groups.discovery.$rejected"))
            compose.onNodeWithTag("groups.member.$approved").assertDoesNotExist()
            compose.onNodeWithTag("groups.member.$rejected").assertDoesNotExist()
            captureLocalUi(compose, "local-membership-other-account.png")
        }
    }

    private fun join(club: String) {
        waitFor(hasTestTag("groups.discovery.$club"))
        compose.onNode(hasTestTag(SgmTestTags.GroupsJoinAction) and hasAnyAncestor(hasTestTag("groups.discovery.$club")))
            .performScrollTo().assertIsEnabled().performClick()
    }
    private fun pending(club: String) { waitFor(hasText("Demandé") and hasAnyAncestor(hasTestTag("groups.discovery.$club"))) }
    private fun member(club: String) {
        waitFor(hasTestTag("groups.member.$club"))
        compose.onNodeWithTag("groups.member.$club").performScrollTo().assertIsDisplayed()
        compose.onNode(hasTestTag(SgmTestTags.GroupsJoinAction) and hasAnyAncestor(hasTestTag("groups.member.$club"))).assertDoesNotExist()
    }
    private fun refresh() {
        compose.onNodeWithTag(SgmTestTags.GroupsRefreshAction).performScrollTo().assertIsEnabled().performClick()
    }
    private fun openGroups() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("Mon club").performScrollTo().performClick()
        waitFor(hasTestTag(SgmTestTags.GroupsScreen))
    }
    private fun login(email: String, password: String) {
        waitFor(hasTestTag(SgmTestTags.AuthEmailAction))
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(email)
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(password)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(hasTestTag(SgmTestTags.HomeScreen))
    }
    private fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
    }
}
