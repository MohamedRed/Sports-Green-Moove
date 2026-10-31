package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.AuthSession
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal enum class SessionRestorationPhase { Pending, Loading, Failed, Ready }

internal class SessionRestorationState(private val readSession: suspend () -> AuthSession?) {
    var phase by mutableStateOf(SessionRestorationPhase.Pending)
        private set
    var attempt by mutableStateOf(0)
        private set
    private var closed = false

    suspend fun restore(accept: suspend (AuthSession?) -> Unit) {
        if (closed || phase != SessionRestorationPhase.Pending) return
        execute(readSession, accept)
    }

    fun retry() {
        if (closed || phase != SessionRestorationPhase.Failed) return
        phase = SessionRestorationPhase.Pending
        attempt++
    }

    suspend fun disconnect(signOut: () -> Unit, accept: suspend (AuthSession?) -> Unit) {
        if (closed || phase != SessionRestorationPhase.Failed) return
        execute({ signOut(); null }, accept)
    }

    private suspend fun execute(load: suspend () -> AuthSession?, accept: suspend (AuthSession?) -> Unit) {
        phase = SessionRestorationPhase.Loading
        try {
            val restored = load()
            currentCoroutineContext().ensureActive()
            if (closed) return
            accept(restored)
            currentCoroutineContext().ensureActive()
            if (!closed) phase = SessionRestorationPhase.Ready
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            if (!closed) phase = SessionRestorationPhase.Failed
        }
    }

    fun close() { closed = true }
}
