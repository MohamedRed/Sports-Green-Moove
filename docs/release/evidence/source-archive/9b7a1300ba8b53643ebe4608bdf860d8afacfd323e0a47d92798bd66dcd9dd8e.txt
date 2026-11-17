package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime

internal object TripChangeDraftCodec {
    fun key(uid: String, tripId: String): String = JSONArray(listOf(TripChangeWire.id(uid), TripChangeWire.id(tripId))).toString()

    fun encode(uid: String, tripId: String, record: TripChangeDraftRecord): String {
        val input = record.input
        fun place(value: TripChangePlaceInput) = JSONObject().put("input", value.input)
            .put("point", value.point?.let { JSONObject(mapOf("lat" to it.lat, "lng" to it.lng)) } ?: JSONObject.NULL)
            .put("address", value.address ?: JSONObject.NULL)
        val raw = JSONObject().put("version", 1).put("uid", uid).put("tripId", tripId)
            .put("revision", record.revision).put("original", JSONObject(TripChangeWire.termsPayload(record.original)))
            .put("input", JSONObject().put("departureDate", input.departureDate.toString()).put("departureTime", input.departureTime.toString())
                .put("arrivalDate", input.arrivalDate.toString()).put("arrivalTime", input.arrivalTime.toString())
                .put("hasArrival", input.hasArrival).put("price", input.price).put("origin", place(input.origin)).put("destination", place(input.destination)))
            .put("pendingProposal", record.pendingProposal?.let { JSONObject(it.callablePayload()) } ?: JSONObject.NULL).toString()
        check(decode(uid, tripId, raw) == record)
        return raw
    }

    fun decode(uid: String, tripId: String, raw: String): TripChangeDraftRecord {
        check(raw.length <= 32_768)
        val json = map(JSONObject(raw))
        check(json["version"] == 1 && json["uid"] == uid && json["tripId"] == tripId)
        key(uid, tripId)
        val revision = TripChangeWire.hash(json["revision"])
        val original = TripChangeWire.terms(json["original"])
        val input = TripChangeWire.map(json["input"])
        fun text(value: Any?, limit: Int): String = (value as? String)?.also { check(it.length <= limit) } ?: error("Invalid draft text")
        fun place(raw: Any?): TripChangePlaceInput {
            val place = TripChangeWire.map(raw)
            check(place.containsKey("point") && place.containsKey("address"))
            val point = place["point"]?.let(TripChangeWire::point)
            val address = place["address"]?.let { text(it, 4096) }
            check(point != null || address == null)
            return TripChangePlaceInput(text(place["input"], 4096), point, address)
        }
        val values = TripChangeDraftInput(LocalDate.parse(text(input["departureDate"], 32)), LocalTime.parse(text(input["departureTime"], 32)),
            LocalDate.parse(text(input["arrivalDate"], 32)), LocalTime.parse(text(input["arrivalTime"], 32)),
            TripChangeWire.flag(input["hasArrival"]), text(input["price"], 8), place(input["origin"]), place(input["destination"]))
        check(json.containsKey("pendingProposal"))
        val pending = json["pendingProposal"]?.let { value ->
            val request = TripChangeWire.map(value)
            check(request["tripId"] == tripId && request["expectedRevision"] == revision)
            TripChangeProposalRequest(tripId, revision, TripChangeWire.terms(request["terms"]),
                TripChangeWire.uuid(request["requestId"] as? String ?: error("Invalid request identity")))
        }
        return TripChangeDraftRecord(revision, original, values, pending)
    }

    private fun map(json: JSONObject): Map<String, Any?> = json.keys().asSequence().associateWith { key ->
        when (val value = json.get(key)) {
            JSONObject.NULL -> null
            is JSONObject -> map(value)
            else -> value
        }
    }
}
