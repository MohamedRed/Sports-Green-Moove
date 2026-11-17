package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class BookingFeedbackLayoutTest {
    @get:Rule val compose = createComposeRule()

    @Test fun narrowLargeTextKeepsSendingAndConfirmationInsideTheResult() {
        val confirmed = mutableStateOf(false)
        host { SearchMatchCard(UiFlowFixtures.match, sending = !confirmed.value, confirmed = confirmed.value,
            retry = false, requestEnabled = false, onRequest = {}) }
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertIsNotEnabled()
        inside(compose.onNodeWithText("ENVOI EN COURS"))
        capture("booking-feedback-sending-narrow.png")
        compose.runOnIdle { confirmed.value = true }
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertDoesNotExist()
        inside(compose.onNodeWithTag(SgmTestTags.BookingRequestConfirmed))
        capture("booking-feedback-confirmed-narrow.png")
    }

    @Test fun retryIsARealCommandAndCannotRemainEnabledWhileAnotherRequestIsSending() {
        val enabled = mutableStateOf(true)
        var calls = 0
        host { SearchMatchCard(UiFlowFixtures.match, sending = false, confirmed = false,
            retry = true, requestEnabled = enabled.value, onRequest = { calls++ }) }
        inside(compose.onNodeWithText("RÉESSAYER"))
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertIsEnabled().performClick()
        compose.runOnIdle { assertTrue(calls == 1); enabled.value = false }
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertIsNotEnabled()
    }

    @Test fun reconstructedSemanticsCannotTurnAParentWidthIntoAClippedLabelClaim() {
        host { V2Button("Réessayer", {}, full = true, size = V2ButtonSize.Sm) }
        val node = compose.onNodeWithText("RÉESSAYER")
        val reported = reportedTextLayout(node)
        val measured = assertMeasuredTextFits(reported)
        assertTrue(reported.multiParagraph.width > reported.size.width)
        assertTrue(reported.didOverflowWidth && !reported.didOverflowHeight)
        inside(node)
        val result = JSONObject().put("scope", "controlled-reconstructed-semantics-comparison-not-phone-flow")
            .put("fontScale", 1.5).put("measuredWidthPx", reported.size.width).put("measuredHeightPx", reported.size.height)
            .put("reportedParagraphWidthPx", reported.multiParagraph.width.toDouble())
            .put("reportedParagraphHeightPx", reported.multiParagraph.height.toDouble())
            .put("reportedWidthOverflow", reported.didOverflowWidth).put("reportedHeightOverflow", reported.didOverflowHeight)
            .put("remeasuredParagraphWidthPx", measured.width.toDouble()).put("remeasuredParagraphHeightPx", measured.height.toDouble())
            .put("wholeLabelFitsMeasuredFrame", true)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val name = "booking-feedback-width-probe.json"
        File(context.getExternalFilesDir(null), "local-ui-evidence/$name").also { it.parentFile?.mkdirs(); it.writeText(result.toString(2)) }
        val device = UiDevice.getInstance(instrumentation)
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-booking-feedback")
        device.executeShellCommand("cp /sdcard/Android/data/${context.packageName}/files/local-ui-evidence/$name /sdcard/Download/sgm-booking-feedback/$name")
    }

    private fun host(content: @androidx.compose.runtime.Composable () -> Unit) {
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.5f)) {
                Box(Modifier.width(320.dp).fillMaxHeight().testTag("booking.feedback.host")) { content() }
            }
        }
    }
    private fun inside(node: SemanticsNodeInteraction) {
        val host = compose.onNodeWithTag("booking.feedback.host").fetchSemanticsNode().boundsInRoot
        val bounds = node.assertIsDisplayed().fetchSemanticsNode().boundsInRoot
        assertTrue(bounds.left >= host.left && bounds.right <= host.right)
        assertMeasuredTextFits(reportedTextLayout(node))
    }
    private fun capture(name: String) {
        captureLocalUi(compose, name)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-booking-feedback")
        device.executeShellCommand("cp /sdcard/Android/data/${instrumentation.targetContext.packageName}/files/local-ui-evidence/$name /sdcard/Download/sgm-booking-feedback/$name")
    }
}
