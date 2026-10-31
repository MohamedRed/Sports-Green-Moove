package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.SupportSubmission
import be.sportgreenmoove.app.services.FileSupportSubmissionStore
import be.sportgreenmoove.app.services.SupportSubmissionStore
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.UUID

class SupportSubmissionFlowTest {
    @get:Rule val compose = createComposeRule()
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    @Test fun lostAcknowledgementRestoresFrozenUrgentRequestAndRetriesExplicitlyAtNarrowLargeText() {
        val dir = File(instrumentation.targetContext.noBackupFilesDir, "support-test-" + UUID.randomUUID())
        val calls = mutableListOf<SupportSubmission>(); val committed = mutableSetOf<String>()
        fun state() = SupportSubmissionState("parent", FileSupportSubmissionStore(dir)) {
            calls += it; committed += it.requestId
            if (calls.size == 1) error("Response lost after commit") else "report-1"
        }
        var visible by mutableStateOf(state())
        try {
            compose.setSgmUiTestContent {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                    Box(Modifier.width(320.dp).safeDrawingPadding().verticalScroll(rememberScrollState())) { SupportSubmissionCard(visible) }
                }
            }
            compose.onNodeWithTag(SgmTestTags.SupportReportDescriptionInput).performScrollTo().performTextInput("Demande de test conservée")
            compose.onNodeWithTag("support.urgent").performScrollTo().performClick()
            compose.onNodeWithTag(SgmTestTags.SupportReportAction).performScrollTo().performClick()
            compose.waitUntil(30_000) { visible.pending != null && !visible.busy }
            compose.onNodeWithTag(SgmTestTags.SupportReportDescriptionInput).assertIsNotEnabled()
            compose.onNodeWithTag("support.urgent").assertIsOn().assertIsNotEnabled()
            capture("support-submission-unconfirmed")
            compose.runOnIdle { visible.close(); visible = state() }
            compose.onNodeWithTag(SgmTestTags.SupportReportDescriptionInput).assertTextEquals("Demande de test conservée")
            compose.onNodeWithTag("support.urgent").assertIsOn(); compose.runOnIdle { assertEquals(1, calls.size) }
            capture("support-submission-restored")
            compose.onNodeWithTag(SgmTestTags.SupportReportAction).performScrollTo().performClick()
            compose.waitUntil(30_000) { visible.pending == null && !visible.busy }
            compose.onNodeWithTag("support.submission.message").assertTextEquals("Signalement envoyé: report-1").assertIsDisplayed()
            compose.onNodeWithTag(SgmTestTags.SupportReportDescriptionInput).assertIsEnabled()
            compose.runOnIdle { assertEquals(2, calls.size); assertEquals(calls[0], calls[1]); assertEquals(1, committed.size) }
            capture("support-submission-confirmed")
        } finally { compose.runOnIdle { visible.close() }; dir.deleteRecursively() }
    }
    @Test fun storageReadFailureDoesNotOfferAnEmptyEditableSend() {
        var calls = 0
        val broken = object : SupportSubmissionStore {
            override fun read(uid: String): SupportSubmission? = error("Corrupt record")
            override fun begin(submission: SupportSubmission) = error("Must not write")
            override fun acknowledge(uid: String, requestId: String) = error("Must not clear")
        }
        val state = SupportSubmissionState("parent", broken) { calls++; "report" }
        compose.setSgmUiTestContent { Box(Modifier.safeDrawingPadding().verticalScroll(rememberScrollState())) { SupportSubmissionCard(state) } }
        compose.onNodeWithTag(SgmTestTags.SupportReportDescriptionInput).assertIsNotEnabled()
        compose.onNodeWithTag(SgmTestTags.SupportReportAction).performScrollTo().performClick()
        compose.runOnIdle { assertEquals(0, calls); assertFalse(state.ready) }
        compose.onNodeWithTag("support.submission.message").assertTextEquals("Impossible de retrouver l’envoi en attente. Réessayez.")
        capture("support-submission-storage-error")
    }
    private fun capture(name: String) {
        compose.waitForIdle()
        val folder = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence").apply { mkdirs() }
        check(UiDevice.getInstance(instrumentation).takeScreenshot(File(folder, "$name.png")))
        if (InstrumentationRegistry.getArguments().getString("sgmSupportRecording") == "true") Thread.sleep(1200)
    }
}
