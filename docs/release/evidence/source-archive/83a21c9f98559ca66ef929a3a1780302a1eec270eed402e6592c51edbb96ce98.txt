package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.InboxNotificationSummary

interface NotificationInboxGateway {
    suspend fun loadNotificationInbox(uid: String): List<InboxNotificationSummary>
}

class UnconfiguredNotificationInboxGateway : NotificationInboxGateway {
    override suspend fun loadNotificationInbox(uid: String): List<InboxNotificationSummary> =
        throw ProviderConfigurationException("Veuillez vous connecter pour consulter vos notifications.")
}
