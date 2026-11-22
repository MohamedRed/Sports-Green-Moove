package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.InboxNotificationSummary
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidNotificationInboxGateway(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
) : NotificationInboxGateway {
    override suspend fun loadNotificationInbox(uid: String): List<InboxNotificationSummary> {
        if (auth.currentUser?.uid != uid) throw CancellationException("Notification account changed")
        val response = functions.getHttpsCallable("getNotificationInbox").call(emptyMap<String, Any>()).await().data
        if (auth.currentUser?.uid != uid) throw CancellationException("Notification account changed")
        return parseNotificationInbox(response, uid)
    }
}

internal fun parseNotificationInbox(raw: Any?, uid: String): List<InboxNotificationSummary> {
    val value = raw as? Map<*, *> ?: error("Invalid notification inbox")
    check(uid.isNotBlank() && value.keys == setOf("userId", "notifications") && value["userId"] == uid)
    val rows = value["notifications"] as? List<*> ?: error("Missing notifications")
    check(rows.size <= 20)
    val result = rows.map { item ->
        val row = item as? Map<*, *> ?: error("Invalid notification")
        check(row.keys == setOf("id", "title", "body", "dateLabel", "unread", "initials"))
        fun field(name: String) = row[name] as? String ?: error("Missing notification $name")
        val id = field("id"); check(id.isNotBlank() && id.length <= 256 && '/' !in id && id !in setOf(".", ".."))
        InboxNotificationSummary(id, field("title"), field("body"), field("dateLabel"),
            row["unread"] as? Boolean ?: error("Invalid notification read state"), field("initials"))
    }
    check(result.map { it.id }.distinct().size == result.size)
    return result
}
