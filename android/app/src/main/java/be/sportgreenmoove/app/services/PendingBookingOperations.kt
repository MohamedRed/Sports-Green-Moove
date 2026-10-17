package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.BookingIntentSnapshot
import java.util.UUID

internal data class BookingSlot(val uid: String, val tripId: String, val childId: String?)
internal data class PendingBookingIntent(val tripId: String, val childId: String?, val seats: Int, val terms: BookingIntentSnapshot) {
    fun payload(): Map<String, Any> = buildMap {
        put("tripId", tripId); put("seats", seats); put("expectedBookingIntent", terms.toCallablePayload())
        childId?.let { put("childId", it) }
    }
}
internal data class PendingBookingOperation(val requestId: String, val intent: PendingBookingIntent)
internal interface BookingOperationStorage {
    fun read(slot: BookingSlot): PendingBookingOperation?
    fun write(slot: BookingSlot, operation: PendingBookingOperation?)
}

internal class PendingBookingOperations(private val storage: BookingOperationStorage) {
    fun begin(slot: BookingSlot, intent: PendingBookingIntent): PendingBookingOperation = synchronized(lock) {
        storage.read(slot) ?: PendingBookingOperation(UUID.randomUUID().toString(), intent).also { storage.write(slot, it) }
    }
    fun acknowledge(slot: BookingSlot, requestId: String) = synchronized(lock) {
        if (storage.read(slot)?.requestId == requestId) storage.write(slot, null)
    }
    private companion object { val lock = Any() }
}
