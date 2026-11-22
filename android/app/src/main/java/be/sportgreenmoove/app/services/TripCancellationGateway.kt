package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TripCancellationPreview
import be.sportgreenmoove.app.data.TripCancellationReceipt
import be.sportgreenmoove.app.data.TripCancellationRequest

interface TripCancellationGateway {
    suspend fun previewTripCancellation(tripId: String): TripCancellationPreview
    suspend fun cancelTrip(request: TripCancellationRequest): TripCancellationReceipt
}
