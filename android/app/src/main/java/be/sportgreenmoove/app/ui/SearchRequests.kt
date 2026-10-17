package be.sportgreenmoove.app.ui

import androidx.annotation.MainThread
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch

internal enum class SearchRequest { Origin, Destination, Matches, Booking }

@MainThread
internal class SearchRequests(
    parent: CoroutineScope,
    private val onError: (String?) -> Unit,
    private val onLoading: (Boolean) -> Unit,
    private val onBookingLoading: (Boolean) -> Unit,
) {
    private val lifetime = SupervisorJob(parent.coroutineContext[Job])
    private val scope = CoroutineScope(parent.coroutineContext + lifetime)
    private val versions = mutableMapOf<SearchRequest, Long>()
    private val jobs = mutableMapOf<SearchRequest, Job>()
    private val busy = mutableSetOf<SearchRequest>()
    val isActive get() = lifetime.isActive

    fun <T> launch(key: SearchRequest, action: suspend () -> T, onFailure: (Exception) -> Unit = {}, accept: (T) -> Unit) {
        if (!isActive || (key == SearchRequest.Booking && key in busy)) return
        val version = nextVersion(key)
        jobs.remove(key)?.cancel()
        busy.add(key)
        publishLoading(key)
        onError(null)
        val job = scope.launch(start = CoroutineStart.LAZY) {
            try {
                val value = action()
                currentCoroutineContext().ensureActive()
                if (isCurrent(key, version)) accept(value)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) {
                if (isCurrent(key, version)) {
                    onFailure(failure)
                    onError(UserFacingErrorPolicy.messageFor(failure))
                }
            } finally {
                if (isCurrent(key, version)) {
                    jobs.remove(key)
                    busy.remove(key)
                    publishLoading(key)
                }
            }
        }
        jobs[key] = job
        job.start()
    }

    fun invalidate(key: SearchRequest) {
        nextVersion(key)
        jobs.remove(key)?.cancel()
        if (busy.remove(key) && isActive) publishLoading(key)
    }

    fun close() {
        lifetime.cancel()
        jobs.clear()
        busy.clear()
    }

    private fun nextVersion(key: SearchRequest) = ((versions[key] ?: 0L) + 1L).also { versions[key] = it }
    private fun isCurrent(key: SearchRequest, version: Long) = isActive && versions[key] == version
    private fun publishLoading(key: SearchRequest) {
        if (key == SearchRequest.Booking) onBookingLoading(key in busy)
        else onLoading(busy.any { it != SearchRequest.Booking })
    }
}
