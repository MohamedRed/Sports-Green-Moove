package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ProfileCity
import be.sportgreenmoove.app.data.ProfileCityChange

interface ProfileCityGateway {
    suspend fun readProfileCity(uid: String): ProfileCity
    suspend fun saveProfileCity(uid: String, change: ProfileCityChange): ProfileCity
}
class UnconfiguredProfileCityGateway : ProfileCityGateway {
    override suspend fun readProfileCity(uid: String): ProfileCity =
        throw ProviderConfigurationException("Ville indisponible. Veuillez vous connecter.")
    override suspend fun saveProfileCity(uid: String, change: ProfileCityChange): ProfileCity =
        throw ProviderConfigurationException("Ville indisponible. Veuillez vous connecter.")
}
