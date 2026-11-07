package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.ClubSummary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class GroupsLayoutTest {
    @get:Rule val compose = createComposeRule()

    @Test fun loadingAndErrorsCannotLookLikeAConfirmedEmptyList() {
        var refreshed = 0
        compose.setSgmUiTestContent {
            GroupsScreen(emptyList(), {}, loading = true, onRefresh = { refreshed++ })
        }
        compose.onNodeWithText("Chargement...").assertIsDisplayed()
        compose.onNodeWithText("Aucun club lié à votre compte.").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.GroupsRefreshAction).assertIsNotEnabled()
        assertEquals(0, refreshed)
    }

    @Test fun narrowLargeTextRowsKeepActionsInsideTheScreen() {
        var refreshed = 0
        var joined: String? = null
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                Box(Modifier.width(320.dp).testTag("groups.narrow.host")) {
                    GroupsScreen(listOf(club("member", "active"), club("request", "rejected")), {},
                        onJoinClub = { joined = it.id }, onRefresh = { refreshed++ })
                }
            }
        }
        val host = compose.onNodeWithTag("groups.narrow.host").fetchSemanticsNode().boundsInRoot
        for (tag in listOf(SgmTestTags.BackAction, SgmTestTags.GroupsRefreshAction, "groups.member.member",
            "groups.discovery.request", SgmTestTags.GroupsJoinAction)) {
            val node = compose.onNodeWithTag(tag).performScrollTo().assertIsDisplayed().fetchSemanticsNode().boundsInRoot
            assertTrue("$tag must stay inside the narrow screen", node.left >= host.left && node.right <= host.right)
        }
        compose.onNodeWithText("Refusée").assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.GroupsJoinAction).performClick()
        assertEquals("request", joined)
        compose.onNodeWithTag(SgmTestTags.GroupsRefreshAction).performScrollTo().performClick()
        assertEquals(1, refreshed)
    }

    @Test fun anErrorOffersRefreshWithoutStaleJoinControls() {
        var refreshed = 0
        compose.setSgmUiTestContent {
            GroupsScreen(listOf(club("stale", "rejected")), {}, error = "Connexion indisponible.", onRefresh = { refreshed++ })
        }
        compose.onNodeWithText("Connexion indisponible.").assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.GroupsJoinAction).assertDoesNotExist()
        compose.onNodeWithText("Aucun club lié à votre compte.").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.GroupsRefreshAction).performClick()
        assertEquals(1, refreshed)
    }

    private fun club(id: String, status: String) = ClubSummary(id, "Club sportif avec un nom très long", "Football", 2,
        if (status == "active") "MEMBRE" else null, "CS", emptyList(), status, status == "active")
}
