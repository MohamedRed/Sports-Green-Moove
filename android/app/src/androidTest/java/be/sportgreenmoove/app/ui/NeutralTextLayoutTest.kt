package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.design.SgmTheme
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class NeutralTextLayoutTest(private val name: String, private val screen: String, private val dark: Boolean,
    private val width: Int, private val height: Int, private val density: Float) {
    @get:Rule val compose = createComposeRule()

    @Test fun neutralTextRendersInActualScreenComponents() {
        assumeTrue(BuildConfig.DEBUG)
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        compose.setContent {
            SgmTheme(darkTheme = dark) {
                V2ThemeToggleProvider(darkTheme = dark, onToggle = {}) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CompositionLocalProvider(LocalDensity provides Density(density, fontScale = 1.3f)) {
                            Box(Modifier.requiredSize(width.dp, height.dp).sgmTestTag("contrast.viewport")) {
                                if (screen == "trips") TripsScreen(emptyList(), null, 0, {}, {}, {}, {})
                                else SearchScreen(originInput = "", destinationInput = "",
                                    form = defaultSearchForm(UiFlowFixtures.child.id).copy(requireChildTracking = false),
                                    origin = null, destination = null, originSuggestions = emptyList(), destinationSuggestions = emptyList(),
                                    children = listOf(UiFlowFixtures.child), matches = emptyList(), loading = false, error = null,
                                    onBack = {}, onSuggestOrigin = {}, onSuggestDestination = {}, onSelectOrigin = {},
                                    onSelectDestination = {}, onSearch = {}, onRequest = {}, onOriginChanged = {},
                                    onDestinationChanged = {}, onFormChange = {})
                            }
                        }
                    }
                }
            }
        }
        if (screen == "trips") {
            for (label in listOf("Rechercher un trajet", "Mois précédent", "Mois suivant"))
                compose.onNodeWithContentDescription(label).assertIsDisplayed()
        } else {
            compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().assertIsDisplayed()
            compose.onNodeWithTag(SgmTestTags.SearchOriginInput).performScrollTo().assertIsDisplayed()
        }
        captureNeutralTextViewport(compose, name, screen, dark, width, height, density)
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}") fun cases(): Collection<Array<Any>> =
            listOf("search", "trips").flatMap { screen -> listOf(false, true).flatMap { dark ->
                listOf(arrayOf<Any>("$screen-${if (dark) "dark" else "light"}-phone", screen, dark, 320, 700, 3f),
                    arrayOf<Any>("$screen-${if (dark) "dark" else "light"}-wide", screen, dark, 900, 600, 1f))
            } }
    }
}
