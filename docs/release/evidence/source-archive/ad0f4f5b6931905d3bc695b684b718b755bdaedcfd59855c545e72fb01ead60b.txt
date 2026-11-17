package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ReceivedRatingSummary

interface ReceivedRatingsGateway {
    suspend fun readReceivedRatings(uid: String): ReceivedRatingSummary
}
class UnconfiguredReceivedRatingsGateway : ReceivedRatingsGateway {
    override suspend fun readReceivedRatings(uid: String): ReceivedRatingSummary =
        throw ProviderConfigurationException("Avis indisponibles. Veuillez vous connecter.")
}
