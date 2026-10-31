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
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.SupportGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

class SupportInboxFlowTest {
    @get:Rule val compose = createComposeRule()
    private val reply = SupportReply("a".repeat(64), "Votre demande est traitée. Merci pour votre retour.", 1, 1792670400000)
    private val report = SupportReport("ticket", "Question sur un trajet", "Je souhaite vérifier les détails de ma réservation.", false,
        SupportStatus.Closed, 1792666800000, 1792670400000, 1, reply)
    private inner class Gateway : SupportGateway {
        var fail = false; var reads = 0
        override suspend fun supportReports(uid: String, cursor: String?): SupportPage<SupportReport> {
            check(uid == "parent"); reads++; if (fail) error("Read refused")
            return SupportPage(listOf(report), null)
        }
        override suspend fun supportReport(uid: String, reportId: String, cursor: String?): SupportDetail {
            check(uid == "parent" && reportId == report.id); reads++
            return SupportDetail(report, SupportPage(listOf(reply), null))
        }
    }
    @Test fun requesterReadsWrittenReplyAndStatusOnNarrowLargeText() {
        val gateway = Gateway()
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                Box(Modifier.width(320.dp).testTag("support.frame")) { SupportInboxRoute("parent", gateway, {}) }
            }
        }
        waitFor("support.report.ticket")
        compose.onNodeWithTag("support.status.ticket", useUnmergedTree = true).assertTextEquals("Clôturée")
        compose.onNodeWithTag("support.report.ticket").performScrollTo().performClick(); waitFor("support.detail.status")
        compose.onNodeWithTag("support.detail.description").assertTextEquals(report.description)
        val node = compose.onNodeWithTag("support.reply-text.${reply.id}").performScrollTo().assertTextEquals(reply.text).assertIsDisplayed()
        val bounds = node.fetchSemanticsNode().boundsInRoot; val frame = compose.onNodeWithTag("support.frame").fetchSemanticsNode().boundsInRoot
        assertTrue(bounds.left >= frame.left && bounds.right <= frame.right)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val folder = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence").apply { mkdirs() }
        check(UiDevice.getInstance(instrumentation).takeScreenshot(File(folder, "support-requester-narrow.png")))
        assertEquals(2, gateway.reads)
    }
    @Test fun failedReadIsNotShownAsAnEmptyInboxAndRefreshIsExplicit() {
        val gateway = Gateway().apply { fail = true }
        compose.setSgmUiTestContent { SupportInboxRoute("parent", gateway, {}) }
        waitFor("support.error"); compose.onNodeWithTag("support.empty").assertDoesNotExist(); assertEquals(1, gateway.reads)
        gateway.fail = false; compose.onNodeWithTag("support.refresh").performClick(); waitFor("support.report.ticket")
        compose.onNodeWithTag("support.error").assertDoesNotExist(); assertEquals(2, gateway.reads)
    }
    private fun waitFor(tag: String) { compose.waitUntil(30_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() } }
}
