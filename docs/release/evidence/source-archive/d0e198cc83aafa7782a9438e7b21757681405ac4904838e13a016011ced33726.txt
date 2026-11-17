package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmDarkColors
import be.sportgreenmoove.app.design.SgmLightColors
import be.sportgreenmoove.app.design.SgmTheme
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import kotlin.math.max
import kotlin.math.min

@RunWith(Parameterized::class)
class FormFeedbackLayoutTest(private val name: String, private val dark: Boolean,
    private val width: Int, private val height: Int, private val density: Float) {
    @get:Rule val compose = createComposeRule()

    @Test fun actualFormFeedbackIsCompleteAndReadable() {
        assumeTrue(BuildConfig.DEBUG)
        check(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            .executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        var screen by mutableStateOf("auth")
        compose.setContent {
            SgmTheme(darkTheme = dark) {
                V2ThemeToggleProvider(darkTheme = dark, onToggle = {}) {
                    Box(Modifier.fillMaxSize().background(Sgm.colors.bgApp), contentAlignment = Alignment.Center) {
                        CompositionLocalProvider(LocalDensity provides Density(density, fontScale = 1.3f)) {
                            Box(Modifier.requiredSize(width.dp, height.dp).background(Sgm.colors.bgApp)
                                .sgmTestTag("form-feedback.viewport")) {
                                key(screen) { FeedbackFixture(screen, labels.getValue(screen)) }
                            }
                        }
                    }
                }
            }
        }
        for ((state, label) in labels) {
            compose.runOnIdle { screen = state }
            assertFeedback(state, label)
        }
    }

    private fun assertFeedback(screen: String, label: String) {
        val caseName = "$screen-$name"
        val node = compose.onNodeWithText(label, useUnmergedTree = true)
        if (screen == "auth" || screen == "search") node.performScrollTo()
        node.assertIsDisplayed()
        val reported = reportedTextLayout(node)
        check(reported.layoutInput.text.text == label)
        val measured = assertMeasuredTextFits(reported)
        val bounds = node.fetchSemanticsNode().boundsInRoot
        val viewport = compose.onNodeWithTag("form-feedback.viewport").fetchSemanticsNode().boundsInRoot
        check(bounds.width > 0 && bounds.height > 0 && bounds.left >= viewport.left && bounds.right <= viewport.right &&
            bounds.top >= viewport.top && bounds.bottom <= viewport.bottom) { "$caseName: feedback outside viewport" }
        val palette = if (dark) SgmDarkColors else SgmLightColors
        val color = reported.layoutInput.style.color
        check(color != Color.Unspecified)
        check(color == if (screen == "chat-sending") palette.textSecondary else palette.textError)
        val foreground = color.compositeOver(palette.bgApp).luminance().toDouble()
        val background = palette.bgApp.luminance().toDouble()
        val contrast = (max(foreground, background) + 0.05) / (min(foreground, background) + 0.05)
        check(contrast >= 4.5) { "$caseName: feedback contrast $contrast below 4.5:1" }
        if (screen.startsWith("chat-")) {
            val action = compose.onNodeWithTag(SgmTestTags.ChatSendAction)
            if (screen == "chat-error") action.assertIsEnabled() else action.assertIsNotEnabled()
        }
        captureFormFeedbackViewport(compose, caseName, screen, dark, width, height, density,
            JSONObject().put("label", label).put("measuredTextFits", true).put("contrastRatio", contrast)
                .put("measuredWidthPx", reported.size.width).put("measuredHeightPx", reported.size.height)
                .put("measuredParagraphHeightPx", measured.height).put("lineCount", measured.lineCount)
                .put("lastLineEnd", measured.getLineEnd(measured.lineCount - 1)))
    }

    @Composable private fun FeedbackFixture(screen: String, label: String) {
        when (screen) {
            "auth" -> OnboardingScreen(false, label, { _, _, _, _ -> }, {}, {})
            "search" -> SearchErrorFixture(label)
            else -> {
                check(screen in listOf("chat-error", "chat-limit", "chat-sending"))
                ConversationComposer(draft = if (screen == "chat-limit") "x".repeat(1001) else "Message conservé.",
                    onDraft = {}, locked = screen == "chat-error", sending = screen == "chat-sending", enabled = true,
                    error = when (screen) { "chat-limit" -> null; "chat-sending" -> "Ancienne erreur."; else -> label }, onSend = {})
            }
        }
    }

    @Composable private fun SearchErrorFixture(label: String) {
        SearchScreen(originInput = "", destinationInput = "",
            form = SearchFormState("2026-11-18T17:45:00Z", 2, "medium", false, false, true, null),
            origin = null, destination = null, originSuggestions = emptyList(), destinationSuggestions = emptyList(),
            children = emptyList(), matches = emptyList(), loading = false, error = label,
            onBack = {}, onSuggestOrigin = {}, onSuggestDestination = {}, onSelectOrigin = {}, onSelectDestination = {},
            onSearch = {}, onRequest = {}, onOriginChanged = {}, onDestinationChanged = {}, onFormChange = {})
    }

    companion object {
        private val labels = linkedMapOf(
            "auth" to "Connexion refusée. Vérifiez votre e-mail et votre mot de passe.",
            "search" to "Recherche indisponible. Vos choix sont conservés. Réessayez.",
            "chat-error" to "Envoi non confirmé. Votre message est conservé.",
            "chat-limit" to "Maximum 1 000 caractères.", "chat-sending" to "Envoi en cours...",
        )
        @JvmStatic @Parameterized.Parameters(name = "{0}") fun cases(): Collection<Array<Any>> =
            listOf(false, true).flatMap { dark -> listOf(
                arrayOf<Any>("${if (dark) "dark" else "light"}-phone", dark, 320, 700, 3f),
                arrayOf<Any>("${if (dark) "dark" else "light"}-wide", dark, 900, 600, 1f)) }
    }
}
