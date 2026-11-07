package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.RideObservationUpdate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

interface RideObservationGateway {
    fun observeRide(rideSessionId: String): Flow<RideObservationUpdate>
}

class UnconfiguredRideObservationGateway : RideObservationGateway {
    override fun observeRide(rideSessionId: String): Flow<RideObservationUpdate> = flow {
        throw ProviderConfigurationException("Le suivi du trajet n’est pas configuré.")
    }
}
