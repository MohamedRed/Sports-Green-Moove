package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.launch

internal class SessionShutdownState(private val scope: CoroutineScope, private val finish: suspend () -> Unit) {
    var pending by mutableStateOf(false); private set

    fun start(before: () -> Unit, finished: (Boolean) -> Unit) {
        if (pending) return
        pending = true
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            var failed = false
            try { try { before() } finally { finish() } }
            catch (cancelled: CancellationException) { failed = true; throw cancelled }
            catch (_: Exception) { failed = true }
            finally { try { finished(failed) } finally { pending = false } }
        }
    }
}

@Composable
internal fun rememberSessionShutdown(providers: AndroidProviderSet): SessionShutdownState {
    val scope = rememberCoroutineScope()
    return remember(providers, scope) { SessionShutdownState(scope) { signOutProviders(providers) } }
}
