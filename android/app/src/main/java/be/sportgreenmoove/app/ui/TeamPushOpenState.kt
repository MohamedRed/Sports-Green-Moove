package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.TeamPushAlertGateway
import be.sportgreenmoove.app.services.TeamPushAlertUnavailableException
import be.sportgreenmoove.app.services.TeamPushOpenRequest
import kotlinx.coroutines.CancellationException

internal enum class TeamPushOpenPhase { Loading, Open, Unavailable, Retry }
internal class TeamPushOpenState(private val request: TeamPushOpenRequest, private val uid: String,
    private val adult: Boolean, private val gateway: TeamPushAlertGateway?) {
    var phase by mutableStateOf(TeamPushOpenPhase.Loading); private set
    var target by mutableStateOf<TeamConversationTarget?>(null); private set
    private var generation = 0
    private var closed = false
    suspend fun load() {
        if (closed) return
        val attempt = ++generation; phase = TeamPushOpenPhase.Loading; target = null
        if (request.uid != uid || !adult || gateway == null) { phase = TeamPushOpenPhase.Unavailable; return }
        try {
            val resolved = gateway.open(request)
            if (attempt != generation || closed) return
            target = resolved; phase = if (resolved == null) TeamPushOpenPhase.Unavailable else TeamPushOpenPhase.Open
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: TeamPushAlertUnavailableException) { if (attempt == generation && !closed) phase = TeamPushOpenPhase.Unavailable }
        catch (_: Exception) { if (attempt == generation && !closed) phase = TeamPushOpenPhase.Retry }
    }
    fun hide() { generation++; target = null; phase = TeamPushOpenPhase.Loading }
    fun close() { closed = true; hide() }
}
