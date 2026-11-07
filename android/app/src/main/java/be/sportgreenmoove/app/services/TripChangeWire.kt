package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import java.time.Instant
import java.util.UUID

internal object TripChangeWire {
    private const val invalid = "Modification non confirmée. Actualisez le trajet."
    fun id(value: Any?): String = (value as? String)?.takeIf {
        it.isNotBlank() && it !in setOf(".", "..") && !Regex("^__.*__$").matches(it) && '/' !in it && it.length <= 256
    } ?: error(invalid)
    fun hash(value: Any?): String = (value as? String)?.takeIf { Regex("^[a-f0-9]{64}$").matches(it) } ?: error(invalid)
    fun uuid(value: String): String = value.also { check(UUID.fromString(it).toString() == it) { invalid } }
    fun integer(value: Any?, min: Int = 0, max: Int = 100): Int {
        val number = (value as? Number)?.toDouble() ?: error(invalid)
        check(number.isFinite() && number % 1.0 == 0.0 && number in min.toDouble()..max.toDouble()) { invalid }
        return number.toInt()
    }
    fun date(value: Any?): String = (value as? String)?.also { Instant.parse(it) } ?: error(invalid)
    fun map(value: Any?): Map<*, *> = value as? Map<*, *> ?: error(invalid)
    fun flag(value: Any?): Boolean = value as? Boolean ?: error(invalid)
    fun ids(value: Any?): List<String> = (value as? List<*>)?.map(::id)?.also {
        check(it.size <= 100 && it.distinct().size == it.size) { invalid }
    } ?: error(invalid)
    private fun coordinate(value: Any?, range: ClosedFloatingPointRange<Double>): Double {
        val number = (value as? Number)?.toDouble() ?: error(invalid)
        check(number.isFinite() && number in range) { invalid }; return number
    }
    fun point(value: Any?): MapPoint = map(value).let {
        MapPoint(coordinate(it["lat"], -90.0..90.0), coordinate(it["lng"], -180.0..180.0))
    }
    fun terms(value: Any?): TripChangeTerms = map(value).let {
        check(it.containsKey("arrivalBy")) { invalid }
        val departure = date(it["departureAt"])
        val arrival = it["arrivalBy"]?.let(::date)
        check(arrival == null || !Instant.parse(arrival).isBefore(Instant.parse(departure))) { invalid }
        TripChangeTerms(departure, arrival, point(it["origin"]), point(it["destination"]), integer(it["priceCents"], max = 100_000))
    }
    fun termsPayload(terms: TripChangeTerms): Map<String, Any?> = mapOf(
        "departureAt" to terms.departureAt, "arrivalBy" to terms.arrivalBy,
        "origin" to mapOf("lat" to terms.origin.lat, "lng" to terms.origin.lng),
        "destination" to mapOf("lat" to terms.destination.lat, "lng" to terms.destination.lng), "priceCents" to terms.priceCents,
    ).also { TripChangeWire.terms(it) }
    fun reference(tripId: String, proposalId: String) = mapOf("tripId" to id(tripId), "proposalId" to hash(proposalId))
}

internal fun TripChangeProposalRequest.callablePayload(): Map<String, Any?> = mapOf(
    "tripId" to TripChangeWire.id(tripId), "requestId" to TripChangeWire.uuid(requestId),
    "expectedRevision" to TripChangeWire.hash(expectedRevision), "terms" to TripChangeWire.termsPayload(terms),
)
internal fun TripChangeDecisionRequest.callablePayload(): Map<String, Any?> =
    TripChangeWire.reference(tripId, proposalId) + mapOf("requestId" to TripChangeWire.uuid(requestId),
        "proposalRevision" to TripChangeWire.hash(proposalRevision), "decision" to decision.wire)
internal fun TripChangeWithdrawalRequest.callablePayload(): Map<String, Any?> =
    TripChangeWire.reference(tripId, proposalId) + ("requestId" to TripChangeWire.uuid(requestId))
internal fun TripChangeQuoteRequest.callablePayload(): Map<String, Any?> =
    TripChangeWire.reference(tripId, proposalId) + mapOf("requestId" to TripChangeWire.uuid(requestId),
        "proposalRevision" to TripChangeWire.hash(proposalRevision))
internal fun TripChangeApplyRequest.callablePayload(): Map<String, Any?> =
    TripChangeWire.reference(tripId, proposalId) + mapOf("requestId" to TripChangeWire.uuid(requestId),
        "proposalRevision" to TripChangeWire.hash(proposalRevision), "quoteId" to TripChangeWire.hash(quoteId))
