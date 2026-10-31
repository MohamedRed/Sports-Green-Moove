package be.sportgreenmoove.app.services

interface NotificationReadGateway {
    suspend fun markNotificationRead(uid: String, notificationId: String)
}

class UnconfiguredNotificationReadGateway : NotificationReadGateway {
    override suspend fun markNotificationRead(uid: String, notificationId: String): Unit =
        throw ProviderConfigurationException("Veuillez vous connecter pour consulter vos notifications.")
}
