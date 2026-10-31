package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.PendingReviewPage

interface PendingReviewGateway {
    suspend fun loadPendingReviews(cursor: String): PendingReviewPage {
        throw ProviderConfigurationException("Les avis ne sont pas configurés.")
    }
}
