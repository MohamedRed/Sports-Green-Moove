package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.ProfileCity
import be.sportgreenmoove.app.data.ProfileCityChange
import be.sportgreenmoove.app.services.ProfileCityGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ProfileCityFlowTest {
    @get:Rule val compose = createComposeRule()
    @Test fun savesCancelsRemovesAndSwitchesOnlyTheSelectedProfile() {
        val gateway = CityUiFixture(); var uid by mutableStateOf("parent")
        compose.setSgmUiTestContent { host(uid, gateway) }
        waitForText("Non renseignée"); open()
        compose.onNodeWithTag("city.input").performTextReplacement("Liège")
        compose.onNodeWithTag("city.cancel").performClick()
        waitForText("Non renseignée"); assertTrue(gateway.values.isEmpty())
        open(); compose.onNodeWithTag("city.input").performTextReplacement("Liège")
        compose.onNodeWithTag("city.save").performClick(); waitForText("Liège")
        compose.runOnIdle { uid = "driver" }; waitForText("Non renseignée")
        compose.onNodeWithText("Liège").assertDoesNotExist()
        compose.runOnIdle { uid = "parent" }; waitForText("Liège")
        open(); compose.onNodeWithTag("city.remove").performClick(); waitForText("Non renseignée")
        compose.runOnIdle { assertEquals(ProfileCity("parent", null, 2), gateway.values["parent"]); assertNull(gateway.values["driver"]) }
    }
    @Test fun failedReadOffersExplicitRefreshWithoutFabricatingAnEmptyProfile() {
        val gateway = CityUiFixture().apply { failRead = true }
        compose.setSgmUiTestContent { host("parent", gateway) }
        waitForText("Indisponible"); open()
        compose.onNodeWithTag("city.input").assertDoesNotExist()
        compose.onNodeWithTag("city.save").assertIsNotEnabled()
        compose.onNodeWithTag("city.error").assertIsDisplayed()
        compose.runOnIdle { gateway.failRead = false }
        compose.onNodeWithTag("city.refresh").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithTag("city.input").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("city.input").assertIsDisplayed()
    }
    @Test fun longCityFitsANarrowProfileWithLargerText() {
        val longCity = "Ottignies-Louvain-la-Neuve, Belgique"
        val gateway = CityUiFixture().apply { values["parent"] = ProfileCity("parent", longCity, 1) }
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.5f)) {
                Box(Modifier.width(280.dp).testTag("city.frame")) { host("parent", gateway) }
            }
        }
        waitForText(longCity)
        val frame = compose.onNodeWithTag("city.frame").fetchSemanticsNode().boundsInRoot
        val text = compose.onNodeWithText(longCity, useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        assertTrue(text.left >= frame.left && text.right <= frame.right && text.bottom <= frame.bottom)
    }
    @Composable private fun host(uid: String, gateway: ProfileCityGateway) {
        ProfileCityHost(uid, gateway) { label, onCity ->
            ProfileSettingsCard("Club QA", label, onCity, {}, {}, {})
        }
    }
    private fun open() { compose.onNodeWithTag("profile.city").performClick() }
    private fun waitForText(value: String) {
        compose.waitUntil(10_000) { compose.onAllNodesWithText(value, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
    }
}

private class CityUiFixture : ProfileCityGateway {
    val values = mutableMapOf<String, ProfileCity>()
    var failRead = false
    override suspend fun readProfileCity(uid: String): ProfileCity {
        if (failRead) error("Isolated read failure")
        return values[uid] ?: ProfileCity(uid, null, 0)
    }
    override suspend fun saveProfileCity(uid: String, change: ProfileCityChange): ProfileCity {
        check((values[uid]?.revision ?: 0) == change.expectedRevision)
        return ProfileCity(uid, change.city, change.expectedRevision + 1).also { values[uid] = it }
    }
}
