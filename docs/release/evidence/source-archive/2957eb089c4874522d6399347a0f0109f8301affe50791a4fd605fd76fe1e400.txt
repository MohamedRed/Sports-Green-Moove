package be.sportgreenmoove.app.ui

import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import be.sportgreenmoove.app.data.InboxNotificationSummary

internal fun LazyListScope.notificationInboxItems(state: NotificationInboxState, reads: NotificationReadState,
    onRetry: () -> Unit, onRead: (InboxNotificationSummary) -> Unit) {
    when {
        state.loading -> item { MessagesEmptyCard("Chargement...") }
        state.error != null -> item {
            MessagesEmptyCard(state.error.orEmpty())
            V2Button("Réessayer", onClick = onRetry, testTag = "notification.inbox.retry")
        }
        else -> {
            if (state.items.isEmpty()) item { MessagesEmptyCard("Aucune notification.") }
            items(state.items, key = { it.id }) { row ->
                val notice = reads.display(row)
                NotificationCard(notice, reads.pendingId != null, reads.pendingId == notice.id, reads.errors[notice.id]) { onRead(notice) }
            }
        }
    }
}
