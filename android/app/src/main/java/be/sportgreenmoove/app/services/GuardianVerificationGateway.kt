package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

interface GuardianVerificationGateway {
    suspend fun guardianOptions(uid: String, kind: GuardianOptionKind, cursor: String?): GuardianPage<GuardianOption>
    suspend fun guardianHistory(uid: String, cursor: String?): GuardianPage<GuardianVerification>
    suspend fun guardianView(uid: String, clubId: String, childId: String): GuardianVerification
    suspend fun transitionGuardian(request: GuardianParentOperation): GuardianTransitionReceipt
}

class UnconfiguredGuardianVerificationGateway : GuardianVerificationGateway {
    override suspend fun guardianOptions(uid: String, kind: GuardianOptionKind, cursor: String?): GuardianPage<GuardianOption> = unavailable()
    override suspend fun guardianHistory(uid: String, cursor: String?): GuardianPage<GuardianVerification> = unavailable()
    override suspend fun guardianView(uid: String, clubId: String, childId: String): GuardianVerification = unavailable()
    override suspend fun transitionGuardian(request: GuardianParentOperation): GuardianTransitionReceipt = unavailable()
    private fun unavailable(): Nothing = throw ProviderConfigurationException("Veuillez vous connecter pour vérifier vos liens parent-enfant.")
}
