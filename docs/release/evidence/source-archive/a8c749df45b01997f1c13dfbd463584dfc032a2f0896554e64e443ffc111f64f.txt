package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

interface EmergencyContactGateway {
    suspend fun discoverChildRideEmergencyContact(uid: String): ChildRideEmergencyContactView?
    suspend fun readChildRideEmergencyContact(uid: String, rideSessionId: String): ChildRideEmergencyContactView
    suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView
    suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt
}
class UnconfiguredEmergencyContactGateway : EmergencyContactGateway {
    override suspend fun discoverChildRideEmergencyContact(uid: String): ChildRideEmergencyContactView? =
        throw ProviderConfigurationException("Contact d’urgence indisponible. Veuillez vous connecter.")
    override suspend fun readChildRideEmergencyContact(uid: String, rideSessionId: String): ChildRideEmergencyContactView =
        throw ProviderConfigurationException("Contact d’urgence indisponible. Veuillez vous connecter.")
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView =
        throw ProviderConfigurationException("Contact d’urgence indisponible. Veuillez vous connecter.")
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt =
        throw ProviderConfigurationException("Contact d’urgence indisponible. Veuillez vous connecter.")
}
