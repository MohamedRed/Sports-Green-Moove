package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
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
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.services.AuthGateway
import be.sportgreenmoove.app.services.UnconfiguredAuthGateway
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.IOException

class SessionRestorationFlowTest {
    @get:Rule val compose = createComposeRule()
    private var reads = 0
    private var signOuts = 0
    private var delivered = mutableListOf<AuthSession?>()
    private val expected = AuthSession("parent-qa", null, null)

    private fun content(read: suspend () -> AuthSession?, narrow: Boolean = false) {
        val auth = object : AuthGateway by UnconfiguredAuthGateway() {
            override suspend fun currentSession(): AuthSession? { reads++; return read() }
            override fun signOut() { signOuts++ }
        }
        compose.setSgmUiTestContent {
            val state = rememberSessionRestoration(auth, true) { delivered.add(it) }
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, if (narrow) 1.5f else density.fontScale)) {
                Box((if (narrow) Modifier.width(320.dp) else Modifier).testTag("session.restore.host")) {
                    if (state.phase == SessionRestorationPhase.Ready) Text("Session vérifiée", Modifier.testTag("session.restore.ready"))
                    else SessionRestorationScreen(state, auth::signOut) { delivered.add(it) }
                }
            }
        }
    }

    @Test fun failedRestorationWaitsForExplicitRetryAndDoesNotPublishSignedOutState() {
        content({ if (reads == 1) throw IOException("unexpected end of stream private-debug-detail") else expected })
        waitFor("session.restore.error")
        compose.onNodeWithText("private-debug-detail", substring = true).assertDoesNotExist()
        compose.onNodeWithTag("session.restore.ready").assertDoesNotExist()
        assertTrue(delivered.isEmpty()); assertEquals(1, reads); assertEquals(0, signOuts)
        capture("session-restoration-error.png")
        compose.onNodeWithTag("session.restore.retry").performScrollTo().performClick()
        waitFor("session.restore.ready")
        assertEquals(listOf(expected), delivered); assertEquals(2, reads); assertEquals(0, signOuts)
    }

    @Test fun disconnectOnlyOccursAfterItsActualAction() {
        content({ throw IOException() })
        waitFor("session.restore.error"); assertEquals(0, signOuts)
        compose.onNodeWithTag("session.restore.disconnect").performScrollTo().performClick()
        waitFor("session.restore.ready")
        assertEquals(1, signOuts); assertEquals(listOf<AuthSession?>(null), delivered); assertEquals(1, reads)
    }

    @Test fun pendingRestorationHasNoLoginRetryOrDisconnectActions() {
        val reply = CompletableDeferred<AuthSession?>()
        content({ reply.await() })
        waitFor("session.restore.loading")
        for (tag in listOf("session.restore.retry", "session.restore.disconnect", SgmTestTags.AuthEmailAction)) {
            compose.onNodeWithTag(tag).assertDoesNotExist()
        }
        assertTrue(delivered.isEmpty()); reply.complete(null)
        waitFor("session.restore.ready"); assertEquals(listOf<AuthSession?>(null), delivered)
    }

    @Test fun narrowLargeTextFailureKeepsBothActionsReachable() {
        content({ throw IOException() }, narrow = true)
        waitFor("session.restore.error")
        val host = compose.onNodeWithTag("session.restore.host").fetchSemanticsNode().boundsInRoot
        for (tag in listOf("session.restore.error", "session.restore.retry", "session.restore.disconnect")) {
            val bounds = compose.onNodeWithTag(tag).performScrollTo().assertIsDisplayed().fetchSemanticsNode().boundsInRoot
            assertTrue(tag, bounds.left >= host.left && bounds.right <= host.right)
        }
        capture("session-restoration-narrow.png")
    }

    private fun capture(name: String) {
        captureLocalUi(compose, name)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-session-restoration")
        device.executeShellCommand("cp /sdcard/Android/data/${instrumentation.targetContext.packageName}/files/local-ui-evidence/$name /sdcard/Download/sgm-session-restoration/$name")
    }

    private fun waitFor(tag: String) = compose.waitUntil(5_000) {
        compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }
}
