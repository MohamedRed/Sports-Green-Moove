package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TripChangeGateway

/** Fixtures not exercising trip changes must fail if one is accidentally dispatched. */
internal object UnusedTripChanges : TripChangeGateway {
    override suspend fun previewTripChange(tripId: String): TripChangePreview = error("Unexpected change preview")
    override suspend fun proposeTripChange(request: TripChangeProposalRequest): TripChangeReview = error("Unexpected proposal")
    override suspend fun reviewTripChange(tripId: String, proposalId: String): TripChangeReview = error("Unexpected review")
    override suspend fun respondTripChange(request: TripChangeDecisionRequest): TripChangeReview = error("Unexpected decision")
    override suspend fun withdrawTripChange(request: TripChangeWithdrawalRequest): TripChangeReview = error("Unexpected withdrawal")
    override suspend fun quoteTripChange(request: TripChangeQuoteRequest): TripChangeRouteQuote = error("Unexpected quote")
    override suspend fun applyTripChange(request: TripChangeApplyRequest): TripChangeApplicationReceipt = error("Unexpected application")
}
