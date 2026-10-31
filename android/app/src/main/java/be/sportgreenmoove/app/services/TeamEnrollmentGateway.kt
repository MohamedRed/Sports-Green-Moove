package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

interface TeamEnrollmentGateway {
    suspend fun teamOptions(uid: String, kind: TeamEnrollmentOptionKind, contextId: String?, cursor: String?): GuardianPage<GuardianOption>
    suspend fun teamEnrollmentView(uid: String, teamId: String, childId: String?): TeamEnrollmentView
    suspend fun changeTeamEnrollment(uid: String, expected: TeamEnrollmentView, action: TeamEnrollmentAction, requestId: String): TeamEnrollmentReceipt
    suspend fun ownedTeamEnrollments(uid: String, cursor: String?): GuardianPage<TeamEnrollmentView>
    suspend fun ownedTeamEnrollmentView(uid: String, enrollmentId: String): TeamEnrollmentView
    suspend fun withdrawOwnedTeamEnrollment(uid: String, expected: TeamEnrollmentView, requestId: String): TeamEnrollmentReceipt
}

class UnconfiguredTeamEnrollmentGateway : TeamEnrollmentGateway {
    override suspend fun teamOptions(uid: String, kind: TeamEnrollmentOptionKind, contextId: String?, cursor: String?): GuardianPage<GuardianOption> = unavailable()
    override suspend fun teamEnrollmentView(uid: String, teamId: String, childId: String?): TeamEnrollmentView = unavailable()
    override suspend fun changeTeamEnrollment(uid: String, expected: TeamEnrollmentView, action: TeamEnrollmentAction, requestId: String): TeamEnrollmentReceipt = unavailable()
    override suspend fun ownedTeamEnrollments(uid: String, cursor: String?): GuardianPage<TeamEnrollmentView> = unavailable()
    override suspend fun ownedTeamEnrollmentView(uid: String, enrollmentId: String): TeamEnrollmentView = unavailable()
    override suspend fun withdrawOwnedTeamEnrollment(uid: String, expected: TeamEnrollmentView, requestId: String): TeamEnrollmentReceipt = unavailable()
    private fun unavailable(): Nothing = throw ProviderConfigurationException("Veuillez vous connecter pour consulter vos inscriptions aux équipes.")
}
