package be.sportgreenmoove.app.data

import java.util.UUID

sealed interface TripCancellationPreview {
    val tripId: String
    val bookingCount: Int
    val refundPendingCount: Int
}

data class TripCancellationReady(
    override val tripId: String,
    val revision: String,
    override val bookingCount: Int,
    override val refundPendingCount: Int,
) : TripCancellationPreview

data class TripCancellationRequest(
    val tripId: String,
    val expectedRevision: String,
    val reason: String,
    val requestId: String = UUID.randomUUID().toString(),
)

data class TripCancellationReceipt(
    override val tripId: String,
    val requestId: String,
    val expectedRevision: String,
    val reason: String,
    val actorUserId: String,
    val cancelledAt: String,
    val bookingIds: List<String>,
    override val refundPendingCount: Int,
    val seatsAvailable: Int,
) : TripCancellationPreview {
    override val bookingCount: Int get() = bookingIds.size
}
