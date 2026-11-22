package be.sportgreenmoove.app.services

import com.google.android.gms.tasks.Task
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await

internal class QueuedTeamPushTokenSource(
    private val autoInit: (Boolean) -> Unit,
    private val acquire: () -> Task<String>,
    private val remove: () -> Task<Void>,
) : TeamPushTokenSource {
    private val mutex = Mutex()
    private var previous: Task<*>? = null
    override fun setAutoInit(enabled: Boolean) = autoInit(enabled)
    override suspend fun token(): String = operation(acquire)
    override suspend fun deleteToken() { operation(remove) }

    private suspend fun <T> operation(start: () -> Task<T>): T = mutex.withLock {
        // Cancelling an await does not cancel the SDK request. Its effects must finish before the next operation.
        previous?.let { prior ->
            try { prior.await() }
            catch (_: Exception) { currentCoroutineContext().ensureActive() }
        }
        currentCoroutineContext().ensureActive()
        val task = start(); previous = task
        try { task.await() }
        finally { if (task.isComplete) previous = null }
    }
}
