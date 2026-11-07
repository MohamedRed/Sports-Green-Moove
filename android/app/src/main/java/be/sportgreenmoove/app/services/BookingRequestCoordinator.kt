package be.sportgreenmoove.app.services

internal interface BookingRequestTransport {
    suspend fun call(name: String, payload: Map<String, Any>): Map<*, *>
}

internal class BookingRequestCoordinator(
    private val pending: PendingBookingOperations,
    private val transport: BookingRequestTransport,
    private val currentUid: () -> String?,
) {
    suspend fun request(intent: PendingBookingIntent): String {
        val uid = currentUid()?.takeIf(String::isNotBlank) ?: throw ProviderConfigurationException("Reconnectez-vous pour continuer.")
        val slot = BookingSlot(uid, intent.tripId, intent.childId)
        var operation = pending.begin(slot, intent)
        if (operation.intent != intent) {
            val outcome = transport.call("resolveBookingRequest", mapOf("clientRequestId" to operation.requestId, "requesterUserId" to uid))
            requireAccount(uid)
            check(outcome["clientRequestId"] == operation.requestId) { "Booking resolution identity mismatch" }
            when (outcome["state"]) {
                "committed" -> {
                    check((outcome["bookingId"] as? String)?.isNotBlank() == true)
                    pending.acknowledge(slot, operation.requestId)
                    throw ProviderConfigurationException("Une demande précédente est déjà enregistrée. Consultez vos réservations avant de recommencer.")
                }
                "abandoned" -> pending.acknowledge(slot, operation.requestId)
                else -> error("Invalid booking resolution")
            }
            operation = pending.begin(slot, intent)
            check(operation.intent == intent) { "Another booking operation is still pending" }
        }
        requireAccount(uid)
        val response = transport.call("requestBooking", intent.payload() + mapOf(
            "clientRequestId" to operation.requestId, "requesterUserId" to uid))
        requireAccount(uid)
        check(response["clientRequestId"] == operation.requestId && response["status"] == "requested" &&
            (response["trip"] as? Map<*, *>)?.get("id") == intent.tripId) { "Booking response identity mismatch" }
        val bookingId = (response["bookingId"] as? String)?.takeIf(String::isNotBlank) ?: error("Invalid booking response")
        val currentStatus = response["currentBookingStatus"] as? String
        check(currentStatus in setOf("requested", "approved", "declined", "cancelled", "completed")) { "Invalid current booking status" }
        pending.acknowledge(slot, operation.requestId)
        if (currentStatus !in setOf("requested", "approved"))
            throw ProviderConfigurationException("Cette demande a déjà été traitée. Consultez vos réservations.")
        return bookingId
    }
    private fun requireAccount(uid: String) {
        if (currentUid() != uid) throw ProviderConfigurationException("Le compte a changé. Reconnectez-vous pour continuer.")
    }
}
