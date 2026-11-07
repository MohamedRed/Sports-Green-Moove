package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.services.NotificationReadGateway
import kotlinx.coroutines.CancellationException

internal class NotificationReadState(private val uid: String, private val gateway: NotificationReadGateway) {
    private var generation = 0
    private var confirmed by mutableStateOf(setOf<String>())
    var pendingId by mutableStateOf<String?>(null)
        private set
    var errors by mutableStateOf(mapOf<String, String>())
        private set

    fun display(notice: InboxNotificationSummary) = if (notice.id in confirmed) notice.copy(unread = false) else notice

    fun reconcile(notices: List<InboxNotificationSummary>) {
        val readIds = notices.filterNot { it.unread }.map { it.id }.toSet()
        confirmed = confirmed + readIds
        errors = errors - readIds
    }

    suspend fun markRead(notice: InboxNotificationSummary) {
        if (pendingId != null || !display(notice).unread) return
        val attempt = generation
        pendingId = notice.id
        errors = errors - notice.id
        try {
            gateway.markNotificationRead(uid, notice.id)
            if (attempt == generation) confirmed = confirmed + notice.id
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) {
            if (attempt == generation && notice.id !in confirmed) {
                errors = errors + (notice.id to "Lecture non confirmée. Réessayez.")
            }
        } finally {
            if (attempt == generation) pendingId = null
        }
    }

    fun clear() {
        generation++
        confirmed = emptySet(); pendingId = null; errors = emptyMap()
    }
}
