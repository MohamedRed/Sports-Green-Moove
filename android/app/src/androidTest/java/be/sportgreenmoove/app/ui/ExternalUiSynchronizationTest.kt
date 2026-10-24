package be.sportgreenmoove.app.ui

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.junit4.createComposeRule
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.StandardTestDispatcher
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

class ExternalUiSynchronizationTest {
    @get:Rule val compose = createComposeRule(effectContext = StandardTestDispatcher())

    @Test fun composeAwareExternalWaitProcessesAnAlreadyCompletedCallbackContinuation() {
        val entered = CompletableDeferred<Unit>()
        val callback = CompletableDeferred<Unit>()
        val externalStateVisible = AtomicBoolean(false)
        compose.setContent {
            LaunchedEffect(Unit) {
                entered.complete(Unit)
                callback.await()
                externalStateVisible.set(true)
            }
        }
        compose.waitForIdle(); assertTrue(entered.isCompleted)
        thread { callback.complete(Unit) }.join()
        assertTrue(callback.isCompleted)
        assertFalse("A callback completion alone must not impersonate the effect continuing", externalStateVisible.get())
        var observed: Boolean? = null
        awaitLocalExternalUi(compose, 60_000, { externalStateVisible.get() }) { observed = it }
        assertTrue(externalStateVisible.get())
        assertEquals(true, observed)
    }

    @Test fun failedDiagnosticCannotReplaceTheOriginalExternalWindowTimeout() {
        compose.setContent { }
        var observed: Boolean? = null
        val failure = runCatching {
            awaitLocalExternalUi(compose, 1, { false }) { observed = it; error("Diagnostic fixture failed") }
        }.exceptionOrNull()
        assertTrue(failure is ComposeTimeoutException); assertEquals(false, observed)
        assertEquals("Diagnostic fixture failed", requireNotNull(failure).suppressed.single().message)
    }

    @Test fun aVisibleWindowDoesNotSuppressADiagnosticFailure() {
        compose.setContent { }
        val failure = runCatching {
            awaitLocalExternalUi(compose, 60_000, { true }) { appeared -> check(appeared); error("Diagnostic fixture failed") }
        }.exceptionOrNull()
        assertTrue(failure is IllegalStateException); assertEquals("Diagnostic fixture failed", failure?.message)
    }
}
