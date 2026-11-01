package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.NotificationInboxGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first

internal class NotificationInboxState(private val uid: String, private val gateway: NotificationInboxGateway,
    private val onRows: (List<InboxNotificationSummary>) -> Unit) {
    private var generation = 0L
    private var busy = false
    private var closed = false
    private val recovery = MutableStateFlow(0L)
    var items by mutableStateOf(emptyList<InboxNotificationSummary>()); private set
    var loading by mutableStateOf(true); private set
    var error by mutableStateOf<String?>(null); private set

    suspend fun observe() {
        if (closed) return
        try {
            while (currentCoroutineContext().isActive && !closed) {
                val recoveryVersion = recovery.value
                refresh()
                if (error != null) recovery.first { it > recoveryVersion }
                delay(4_000)
            }
        } finally { pause() }
    }

    suspend fun refresh() {
        if (closed || busy) return
        val ticket = generation; busy = true
        try {
            val rows = gateway.loadNotificationInbox(uid)
            currentCoroutineContext().ensureActive()
            if (ticket != generation || closed) return
            val recovered = error != null
            items = rows; onRows(rows); error = null; loading = false
            if (recovered) recovery.value++
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) {
            if (ticket == generation && !closed) {
                items = emptyList(); error = UserFacingErrorPolicy.messageFor(failure); loading = false
            }
        } finally { if (ticket == generation) busy = false }
    }

    fun pause() {
        generation++; busy = false; items = emptyList(); loading = true; error = null
    }
    fun close() { closed = true; pause() }
}
