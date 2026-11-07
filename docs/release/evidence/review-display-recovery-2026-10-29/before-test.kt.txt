package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.ReceivedRatingSummary
import be.sportgreenmoove.app.services.ReceivedRatingsGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ReceivedRatingsFlowTest {
    @get:Rule val compose = createComposeRule()
    @Test fun showsOnlyMeanAndCountAndSwitchesAccountsWithoutLeakingTheOldScore() {
        val values = mutableMapOf("driver" to ReceivedRatingSummary("driver", 104, 358.0 / 104))
        var uid by mutableStateOf("driver")
        val gateway = object : ReceivedRatingsGateway {
            override suspend fun readReceivedRatings(uid: String) = values[uid] ?: ReceivedRatingSummary(uid, 0, null)
        }
        compose.setSgmUiTestContent { ProfileReceivedRatings(uid, gateway) }
        waitFor("3,4 / 5"); compose.onNodeWithText("104 avis reçus").assertIsDisplayed()
        compose.runOnIdle { uid = "parent" }; waitFor("Aucun avis reçu")
        compose.onNodeWithText("3,4 / 5").assertDoesNotExist()
        compose.onNodeWithText("104 avis reçus").assertDoesNotExist()
        compose.runOnIdle { values["parent"] = ReceivedRatingSummary("parent", 1, 5.0) }
        compose.onNodeWithTag("profile.received-ratings.refresh").performClick()
        waitFor("5,0 / 5"); compose.onNodeWithText("1 avis reçu").assertIsDisplayed()
    }
    @Test fun failedReadCannotLookLikeZeroReviewsAndRetryDoesNotKeepAStaleScore() {
        var fail = true
        val gateway = object : ReceivedRatingsGateway {
            override suspend fun readReceivedRatings(uid: String): ReceivedRatingSummary {
                if (fail) error("Isolated summary read failure")
                return ReceivedRatingSummary(uid, 105, 363.0 / 105)
            }
        }
        compose.setSgmUiTestContent { ProfileReceivedRatings("driver", gateway) }
        waitFor("Avis indisponibles"); compose.onNodeWithText("Aucun avis reçu").assertDoesNotExist()
        compose.runOnIdle { fail = false }; compose.onNodeWithTag("profile.received-ratings.refresh").performClick()
        waitFor("3,5 / 5"); compose.onNodeWithText("105 avis reçus").assertIsDisplayed()
        compose.runOnIdle { fail = true }; compose.onNodeWithTag("profile.received-ratings.refresh").performClick()
        waitFor("Avis indisponibles"); compose.onNodeWithText("105 avis reçus").assertDoesNotExist()
    }
    @Test fun maximumCountFitsNarrowWidthAndLargeFontsWithoutCoveringRefresh() {
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.8f)) {
                Box(Modifier.width(280.dp).sgmTestTag("rating.frame")) {
                    ReceivedRatingsRow(ReceivedRatingSummary("driver", 9_007_199_254_740_991L, 4.9), false, false) {}
                }
            }
        }
        val frame = compose.onNodeWithTag("rating.frame").fetchSemanticsNode().boundsInRoot
        val refresh = compose.onNodeWithTag("profile.received-ratings.refresh").fetchSemanticsNode().boundsInRoot
        for (tag in listOf("value", "count")) {
            val text = compose.onNodeWithTag("profile.received-ratings.$tag").fetchSemanticsNode().boundsInRoot
            assertTrue(text.left >= frame.left && text.right < refresh.left && text.bottom <= frame.bottom)
            val layouts = mutableListOf<TextLayoutResult>()
            compose.onNodeWithTag("profile.received-ratings.$tag").performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            assertFalse(layouts.single().hasVisualOverflow)
        }
        assertTrue(refresh.right <= frame.right)
    }
    private fun waitFor(text: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
