package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import kotlinx.coroutines.CancellationException

internal class GroupsState(
    private val loadClubs: suspend () -> List<ClubSummary>,
    private val requestMembership: suspend (String) -> String,
    private val onLoaded: (List<ClubSummary>) -> Unit = {},
) {
    var clubs by mutableStateOf(emptyList<ClubSummary>()); private set
    var loading by mutableStateOf(true); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    private var generation = 0
    private var closed = false
    private var submitting = false

    suspend fun reload() {
        if (closed || submitting) return
        val request = begin()
        try { publish(request, loadClubs()) }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { fail(request, failure) }
        if (current(request)) loading = false
    }

    suspend fun join(clubId: String) {
        if (closed || loading || submitting || error != null) return
        val club = clubs.singleOrNull { it.id == clubId } ?: return
        if (club.isMember || club.hasPendingRequest) return
        submitting = true
        val request = begin()
        try {
            requestMembership(clubId)
            if (!current(request)) return
            notice = "Demande prise en compte."
            publish(request, loadClubs())
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { fail(request, failure) }
        finally { if (current(request)) submitting = false }
        if (current(request)) loading = false
    }

    fun dismissNotice() { notice = null }
    fun close() { closed = true; generation += 1; clubs = emptyList(); error = null; notice = null }

    private fun begin(): Int {
        generation += 1
        loading = true
        clubs = emptyList()
        error = null
        notice = null
        return generation
    }
    private fun current(request: Int) = !closed && request == generation
    private fun publish(request: Int, result: List<ClubSummary>) {
        if (!current(request)) return
        clubs = result
        onLoaded(result)
    }
    private fun fail(request: Int, failure: Exception) {
        if (current(request)) error = UserFacingErrorPolicy.messageFor(failure)
    }
}
