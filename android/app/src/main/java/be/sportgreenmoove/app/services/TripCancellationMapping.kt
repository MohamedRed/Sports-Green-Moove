package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TripCancellationPreview
import be.sportgreenmoove.app.data.TripCancellationReady
import be.sportgreenmoove.app.data.TripCancellationReceipt
import be.sportgreenmoove.app.data.TripCancellationRequest
import java.time.Instant
import java.util.UUID

private const val InvalidCancellation = "Annulation non confirmée. Actualisez le trajet."
private val revisionPattern = Regex("^[a-f0-9]{64}$")
private fun documentId(value: Any?): String = (value as? String)?.takeIf {
    it.isNotBlank() && it != "." && it != ".." && !Regex("^__.*__$").matches(it) && '/' !in it && it.length <= 256
} ?: throw ProviderConfigurationException(InvalidCancellation)
private fun text(value: Any?): String = (value as? String)?.takeIf { it.isNotBlank() }
    ?: throw ProviderConfigurationException(InvalidCancellation)
private fun revision(value: Any?) = text(value).also { check(revisionPattern.matches(it)) { InvalidCancellation } }
private fun uuid(value: Any?) = text(value).also { check(UUID.fromString(it).toString() == it.lowercase()) { InvalidCancellation } }
private fun count(value: Any?, maximum: Int): Int {
    val number = (value as? Number)?.toDouble() ?: error(InvalidCancellation)
    check(number.isFinite() && number in 0.0..maximum.toDouble() && number % 1.0 == 0.0) { InvalidCancellation }
    return number.toInt()
}

internal fun TripCancellationRequest.callablePayload(): Map<String, String> {
    documentId(tripId); revision(expectedRevision); uuid(requestId)
    check(reason == reason.trim() && reason.length in 5..300) { InvalidCancellation }
    return mapOf("tripId" to tripId, "expectedRevision" to expectedRevision, "requestId" to requestId, "reason" to reason)
}

internal fun tripCancellationPreview(raw: Any?, tripId: String): TripCancellationPreview {
    val data = raw as? Map<*, *> ?: error(InvalidCancellation)
    check(documentId(data["tripId"]) == tripId) { InvalidCancellation }
    val bookings = count(data["bookingCount"], 100)
    val refunds = count(data["refundPendingCount"], bookings)
    return when (data["status"]) {
        "ready" -> TripCancellationReady(tripId, revision(data["revision"]), bookings, refunds)
        "cancelled" -> {
            val ids = (data["bookingIds"] as? List<*>)?.map(::documentId) ?: error(InvalidCancellation)
            check(ids.size == bookings && ids.distinct().size == ids.size) { InvalidCancellation }
            val reason = text(data["reason"])
            check(reason == reason.trim() && reason.length in 5..300) { InvalidCancellation }
            val cancelledAt = text(data["cancelledAt"])
            Instant.parse(cancelledAt)
            TripCancellationReceipt(tripId, uuid(data["requestId"]), revision(data["expectedRevision"]), reason,
                documentId(data["actorUserId"]), cancelledAt, ids, refunds, count(data["seatsAvailable"], 8))
        }
        else -> error(InvalidCancellation)
    }
}

internal fun tripCancellationReceipt(raw: Any?, request: TripCancellationRequest, uid: String): TripCancellationReceipt {
    val receipt = tripCancellationPreview(raw, request.tripId) as? TripCancellationReceipt ?: error(InvalidCancellation)
    check(receipt.requestId == request.requestId && receipt.expectedRevision == request.expectedRevision &&
        receipt.reason == request.reason && receipt.actorUserId == uid) { InvalidCancellation }
    return receipt
}
