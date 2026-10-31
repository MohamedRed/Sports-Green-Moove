package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

interface SupportGateway {
    suspend fun supportReports(uid: String, cursor: String?): SupportPage<SupportReport>
    suspend fun supportReport(uid: String, reportId: String, cursor: String?): SupportDetail
}
class UnconfiguredSupportGateway : SupportGateway {
    override suspend fun supportReports(uid: String, cursor: String?): SupportPage<SupportReport> = unavailable()
    override suspend fun supportReport(uid: String, reportId: String, cursor: String?): SupportDetail = unavailable()
    private fun unavailable(): Nothing = throw ProviderConfigurationException("Veuillez vous connecter pour consulter vos demandes.")
}
