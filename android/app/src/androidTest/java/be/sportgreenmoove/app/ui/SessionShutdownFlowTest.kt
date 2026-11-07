package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import android.content.res.Configuration
import android.provider.Settings
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.design.SgmTheme
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class SessionShutdownFlowTest {
    @get:Rule val compose = createComposeRule()
    private fun providers() = AndroidProviderSet(object : AuthGateway by UnconfiguredAuthGateway() {
        override val isConfigured = true
    }, object : FirebaseGateway by UnconfiguredFirebaseGateway() { override val isConfigured = true })

    @Test fun pendingExitHidesBothThePrivateAccountAndOnboardingUntilTheActionFinishes() {
        val reply = CompletableDeferred<Unit>(); var state: SessionShutdownState? = null
        val providers = providers()
        compose.setSgmUiTestContent {
            val scope = rememberCoroutineScope()
            val shutdown = remember { SessionShutdownState(scope) { reply.await() } }.also { state = it }
            var session by remember { mutableStateOf<AuthSession?>(AuthSession("synthetic-parent", null, null)) }
            val restoration = remember { SessionRestorationState { null } }
            LaunchedEffect(restoration) { restoration.restore {} }
            LaunchedEffect(shutdown) { shutdown.start({ session = null }, {}) }
            AppAccessGate(providers, restoration, session, shutdown.pending, false, null, scope, {}, {}, {}, { session = it }, {}) {
                Text("Compte privé")
            }
        }
        compose.onNodeWithTag("session.exit.screen").assertIsDisplayed()
        compose.onNodeWithText("Compte privé").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertDoesNotExist()
        compose.runOnIdle { assertTrue(state!!.pending); reply.complete(Unit) }
        compose.waitForComposeNode(hasTestTag(SgmTestTags.AuthEmailAction), 5_000)
        compose.onNodeWithTag("session.exit.screen").assertDoesNotExist()
    }
    @Test fun smallLargeTextExitScreenKeepsTheStatusInsideItsFrame() = frame(false, "session-exit-narrow.png")
    @Test fun wideDarkExitScreenKeepsTheStatusInsideItsFrame() {
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val device = UiDevice.getInstance(instrumentation)
        val autoRotation = Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0)
        try {
            device.setOrientationLeft()
            compose.waitUntil(15_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE }
            frame(true, "session-exit-wide-dark.png")
        } finally {
            device.setOrientationNatural()
            compose.waitUntil(15_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT }
            instrumentation.waitForIdleSync()
            if (autoRotation != 0) device.unfreezeRotation()
        }
    }

    private fun frame(dark: Boolean, capture: String) {
        compose.setContent {
            SgmTheme(darkTheme = dark) {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.5f)) {
                Box(Modifier.width(if (dark) 600.dp else 280.dp).sgmTestTag("session.exit.frame")) { SessionExitScreen() }
            }
            }
        }
        val frame = compose.onNodeWithTag("session.exit.frame").fetchSemanticsNode().boundsInRoot
        if (dark) assertTrue(frame.width > frame.height)
        for (tag in listOf("session.exit.pending", "session.exit.label")) {
            val node = compose.onNodeWithTag(tag); node.assertIsDisplayed()
            val bounds = node.fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= frame.left && bounds.right <= frame.right)
        }
        captureLocalUi(compose, capture, landscape = frame.width > frame.height)
    }
}
