package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ConversationKind
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest

internal class ConversationAccessRevokedException : IllegalStateException("permission-denied: conversation source changed")

internal object ConversationSourceAccess {
    fun permits(kind: ConversationKind, uid: String, source: Map<String, Any?>?): Boolean {
        if (uid.isBlank() || source == null) return false
        return when (kind) {
            ConversationKind.Booking -> source["driverUserId"] == uid ||
                (source["parentUserId"] ?: source["requesterUserId"]) == uid
            ConversationKind.RideSession -> {
                val participants = source.getOrDefault("participantUserIds", emptyList<String>()) as? List<*> ?: return false
                val children = source.getOrDefault("childUserIds", emptyList<String>()) as? List<*> ?: return false
                source["driverUserId"] == uid || uid in participants || uid in children
            }
        }
    }

    // A message listener alone need not emit when its source document changes.
    @OptIn(ExperimentalCoroutinesApi::class)
    fun <T> guard(access: Flow<Boolean>, messages: () -> Flow<T>): Flow<T> =
        access.distinctUntilChanged().flatMapLatest { allowed ->
            if (!allowed) throw ConversationAccessRevokedException()
            messages()
        }
}
