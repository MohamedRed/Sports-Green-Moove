package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmTheme
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class FeedbackTextLayoutTest(private val name: String, private val screen: String, private val dark: Boolean,
    private val width: Int, private val height: Int, private val density: Float) {
    @get:Rule val compose = createComposeRule()

    @Test fun feedbackTextFitsActualComponents() {
        assumeTrue(BuildConfig.DEBUG)
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        compose.setContent {
            SgmTheme(darkTheme = dark) {
                Box(Modifier.fillMaxSize().background(Sgm.colors.bgApp), contentAlignment = Alignment.Center) {
                    CompositionLocalProvider(LocalDensity provides Density(density, fontScale = 1.3f)) {
                        Column(Modifier.requiredSize(width.dp, height.dp).background(Sgm.colors.bgApp)
                            .sgmTestTag("feedback.viewport"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            if (screen == "notices") {
                                RuntimeNotice("Connexion rétablie.", false, {}, Modifier.sgmTestTag("feedback.info"))
                                RuntimeNotice("Réseau indisponible. Réessayez.", true, {}, Modifier.sgmTestTag("feedback.warning"))
                                Box(Modifier.padding(horizontal = 20.dp)) {
                                    ReviewCard(InboxReviewPrompt("feedback-review", "feedback-ride", "feedback-driver",
                                        "Avis conducteur", "Comment s'est passé le trajet ?", "AC"), false,
                                        error = "Envoi de l'avis non confirmé. Réessayez.", onRate = {})
                                }
                            } else if (screen == "input") {
                                OutlinedTextField("Adresse incomplète", {}, modifier = Modifier.padding(horizontal = 20.dp)
                                    .fillMaxWidth(), isError = true, label = { Text("Adresse") },
                                    supportingText = { Text("Vérifiez l'adresse.", color = MaterialTheme.colorScheme.error,
                                        modifier = Modifier.sgmTestTag("feedback.material-error")) })
                            } else {
                                Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    val stale = LiveRideSnapshot("feedback-ride", status = "active",
                                        vehicleLastUpdateLabel = "Position à vérifier depuis 12 min", childLastUpdateLabel = null,
                                        etaLabel = "Arrivée estimée à confirmer", stale = true)
                                    ActiveRideEntryCard(stale) {}
                                    ActiveRideEntryCard(stale.copy(stale = false, etaLabel = "Arrivée 17h05",
                                        vehicleLastUpdateLabel = "Mise à jour à l'instant")) {}
                                    Row(Modifier.background(SgmColor.Orange.copy(alpha = 0.12f).compositeOver(Sgm.colors.bgApp))
                                        .padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        RideStatusPill("À VÉRIFIER", true)
                                        RideStatusPill("LIVE", false)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        val viewport = compose.onNodeWithTag("feedback.viewport").fetchSemanticsNode().boundsInRoot
        val tags = when (screen) {
            "notices" -> listOf("feedback.info", "feedback.warning", "review.submission.error")
            "input" -> listOf("feedback.material-error")
            else -> emptyList()
        }
        retainFeedbackLayoutDiagnostics(compose, name, tags)
        for (tag in tags) {
            val node = compose.onNodeWithTag(tag, useUnmergedTree = true).assertIsDisplayed()
            val layouts = mutableListOf<TextLayoutResult>()
            node.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            check(layouts.isNotEmpty() && layouts.none { it.hasVisualOverflow }) { "$name/$tag: text overflow or missing layout" }
            val bounds = node.fetchSemanticsNode().boundsInRoot
            check(bounds.left >= viewport.left && bounds.right <= viewport.right && bounds.top >= viewport.top && bounds.bottom <= viewport.bottom) {
                "$name/$tag: $bounds outside $viewport"
            }
        }
        if (screen == "ride") {
            compose.onAllNodesWithTag(SgmTestTags.ActiveRideResumeAction).assertCountEquals(2)
            compose.onNodeWithText("À VÉRIFIER").assertIsDisplayed()
            compose.onNodeWithText("LIVE").assertIsDisplayed()
            compose.onNodeWithText("Arrivée estimée à confirmer").assertIsDisplayed()
        }
        captureFeedbackTextViewport(compose, name, screen, dark, width, height, density)
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}") fun cases(): Collection<Array<Any>> =
            listOf("notices", "ride", "input").flatMap { screen -> listOf(false, true).flatMap { dark ->
                listOf(arrayOf<Any>("$screen-${if (dark) "dark" else "light"}-phone", screen, dark, 320, 700, 3f),
                    arrayOf<Any>("$screen-${if (dark) "dark" else "light"}-wide", screen, dark, 900, 600, 1f))
            } }
    }
}
