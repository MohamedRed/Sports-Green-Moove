package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.SgmTheme
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class SearchDepartureLayoutTest(private val dark: Boolean, private val width: Int, private val density: Float) {
    @get:Rule val compose = createComposeRule()
    @Test fun enlargedDateAndTimeFitBothResponsiveFormatsWithoutOverlap() {
        compose.setContent {
            SgmTheme(darkTheme = dark) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CompositionLocalProvider(LocalDensity provides Density(density, fontScale = 1.3f)) {
                        Box(Modifier.requiredSize(width.dp, 300.dp).sgmTestTag("search.departure.viewport")) {
                            SearchDepartureField("2026-11-01T16:30:00Z") {}
                        }
                    }
                }
            }
        }
        val viewport = compose.onNodeWithTag("search.departure.viewport").fetchSemanticsNode().boundsInRoot
        val frames = listOf(SgmTestTags.SearchDateInput, SgmTestTags.SearchTimeInput).map { tag ->
            val frame = compose.onNodeWithTag(tag).assertIsDisplayed().fetchSemanticsNode().boundsInRoot
            assertTrue(frame.left >= viewport.left && frame.right <= viewport.right)
            assertTrue(frame.top >= viewport.top && frame.bottom <= viewport.bottom)
            frame
        }
        assertTrue(frames[0].right <= frames[1].left || frames[0].bottom <= frames[1].top)
        for (label in listOf("01/11/2026", "17:30 · Bruxelles")) {
            val node = compose.onNodeWithText(label, useUnmergedTree = true).assertIsDisplayed()
            assertMeasuredTextFits(reportedTextLayout(node))
        }
    }
    companion object {
        @JvmStatic @Parameterized.Parameters(name = "dark-{0}-width-{1}") fun cases(): Collection<Array<Any>> =
            listOf(false, true).flatMap { dark -> listOf(arrayOf<Any>(dark, 320, 3f), arrayOf<Any>(dark, 900, 1f)) }
    }
}
