package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal class TripChangeQuoteExpiredException : Exception("L’estimation a expiré. Calculez un nouvel itinéraire.")

interface TripChangeGateway {
    suspend fun tripChangeHistory(tripId: String, cursor: String?): TripChangeHistoryPage
    suspend fun previewTripChange(tripId: String): TripChangePreview
    suspend fun proposeTripChange(request: TripChangeProposalRequest): TripChangeReview
    suspend fun resolveTripChangeProposal(request: TripChangeProposalRequest): TripChangeReview?
    suspend fun reviewTripChange(tripId: String, proposalId: String): TripChangeReview
    suspend fun respondTripChange(request: TripChangeDecisionRequest): TripChangeReview
    suspend fun withdrawTripChange(request: TripChangeWithdrawalRequest): TripChangeReview
    suspend fun quoteTripChange(request: TripChangeQuoteRequest): TripChangeRouteQuote
    suspend fun applyTripChange(request: TripChangeApplyRequest): TripChangeApplicationReceipt
}
