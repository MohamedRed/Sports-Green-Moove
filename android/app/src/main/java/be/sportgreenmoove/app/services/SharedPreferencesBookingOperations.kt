package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.data.BookingIntentSnapshot
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal class SharedPreferencesBookingOperations(context: Context) : BookingOperationStorage {
    private val preferences = context.getSharedPreferences("pending-booking-operations", Context.MODE_PRIVATE)
    private fun key(slot: BookingSlot) = JSONArray(listOf(slot.uid, slot.tripId, slot.childId)).toString()

    override fun read(slot: BookingSlot): PendingBookingOperation? {
        val raw = preferences.getString(key(slot), null) ?: return null
        val value = JSONObject(raw)
        val id = value.getString("requestId")
        check(UUID.fromString(id).toString() == id) { "Invalid pending booking identity" }
        val input = value.getJSONObject("intent")
        val terms = checkNotNull(BookingIntentSnapshot.fromCallablePayload(map(input.getJSONObject("expectedBookingIntent"))))
        val child = if (input.isNull("childId")) null else input.getString("childId")
        val seats = input.getInt("seats")
        check(input.getDouble("seats") == seats.toDouble() && seats in 1..8)
        check(input.getString("tripId") == slot.tripId && child == slot.childId) { "Pending booking scope mismatch" }
        return PendingBookingOperation(id, PendingBookingIntent(slot.tripId, child, seats, terms))
    }
    override fun write(slot: BookingSlot, operation: PendingBookingOperation?) {
        val edit = preferences.edit()
        if (operation == null) edit.remove(key(slot))
        else edit.putString(key(slot), JSONObject().put("requestId", operation.requestId)
            .put("intent", JSONObject(operation.intent.payload())).toString())
        check(edit.commit()) { "Cannot preserve pending booking identity" }
    }
    private fun map(json: JSONObject): Map<String, Any?> = json.keys().asSequence().associateWith { key ->
        when (val value = json.get(key)) {
            JSONObject.NULL -> null
            is JSONObject -> map(value)
            else -> value
        }
    }
}
