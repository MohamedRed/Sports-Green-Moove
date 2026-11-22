package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.InboxChatSummary
import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.data.PendingReviewPage
import be.sportgreenmoove.app.data.InboxSummary

internal fun mapInbox(data: Map<*, *>, reviews: PendingReviewPage): InboxSummary =
    InboxSummary(
        notifications = listValue(data["notifications"]).mapNotNull(::mapInboxNotification),
        chats = listValue(data["chats"]).mapNotNull(::mapInboxChat),
        reviews = reviews.items,
        reviewsNextCursor = reviews.nextCursor,
    )

private fun mapInboxNotification(data: Map<*, *>): InboxNotificationSummary? =
    InboxNotificationSummary(
        id = data["id"] as? String ?: return null,
        title = data["title"] as? String ?: "Notification",
        body = data["body"] as? String ?: "",
        dateLabel = data["dateLabel"] as? String ?: "",
        unread = data["unread"] as? Boolean ?: false,
        initials = data["initials"] as? String ?: "NT",
    )

private fun mapInboxChat(data: Map<*, *>): InboxChatSummary? =
    InboxChatSummary(
        id = data["id"] as? String ?: return null,
        sourceType = data["sourceType"] as? String ?: "booking",
        sourceId = data["sourceId"] as? String ?: return null,
        title = data["title"] as? String ?: "Conversation",
        preview = data["preview"] as? String ?: "",
        dateLabel = data["dateLabel"] as? String ?: "",
        unreadCount = (data["unreadCount"] as? Number)?.toInt() ?: 0,
        initials = data["initials"] as? String ?: "CH",
    )

private fun listValue(value: Any?): List<Map<*, *>> =
    (value as? List<*>).orEmpty().mapNotNull { it as? Map<*, *> }
