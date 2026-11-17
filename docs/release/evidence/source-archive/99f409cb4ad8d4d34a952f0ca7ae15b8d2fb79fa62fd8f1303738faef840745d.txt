package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.data.ReservationPage

interface ReservationGateway {
    suspend fun list(role: AppRole, cursor: String? = null): ReservationPage
    suspend fun decide(bookingId: String, decision: ReservationDecision)
}

class UnconfiguredReservationGateway : ReservationGateway {
    override suspend fun list(role: AppRole, cursor: String?): ReservationPage = unavailable()
    override suspend fun decide(bookingId: String, decision: ReservationDecision): Unit = unavailable()
    private fun unavailable(): Nothing = throw ProviderConfigurationException("Le service de réservations n'est pas configuré.")
}
