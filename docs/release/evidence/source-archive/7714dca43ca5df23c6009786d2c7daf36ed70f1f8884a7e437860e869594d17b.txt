package be.sportgreenmoove.app.data

import java.time.Instant

data class BookingIntentSnapshot(
    val departureAt: String, val arrivalBy: String?, val origin: MapPoint, val destination: MapPoint,
    val priceCents: Int, val driverUserId: String, val seatsTotal: Int,
    val clubId: String? = null, val teamId: String? = null, val category: String? = null,
    val pickupRadiusM: Int? = null, val baggage: String? = null, val returnTrip: Boolean? = null,
    val supportsVehicleTracking: Boolean? = null, val supportsChildTracking: Boolean? = null,
    val appliedChangeId: String? = null,
) {
    fun toCallablePayload(): Map<String, Any?> = mapOf(
        "terms" to mapOf("departureAt" to departureAt, "arrivalBy" to arrivalBy,
            "origin" to mapOf("lat" to origin.lat, "lng" to origin.lng),
            "destination" to mapOf("lat" to destination.lat, "lng" to destination.lng), "priceCents" to priceCents),
        "context" to mapOf("driverUserId" to driverUserId, "seatsTotal" to seatsTotal, "clubId" to clubId,
            "teamId" to teamId, "category" to category, "pickupRadiusM" to pickupRadiusM, "baggage" to baggage,
            "returnTrip" to returnTrip, "supportsVehicleTracking" to supportsVehicleTracking,
            "supportsChildTracking" to supportsChildTracking, "appliedChangeId" to appliedChangeId),
    )

    companion object {
        fun fromTripData(data: Map<*, *>): BookingIntentSnapshot? = fromCallablePayload(mapOf(
            "terms" to data, "context" to data,
        ))

        fun fromCallablePayload(data: Map<*, *>): BookingIntentSnapshot? = runCatching {
            val terms = data["terms"] as Map<*, *>
            val context = data["context"] as Map<*, *>
            val departure = terms["departureAt"] as String
            val arrival = terms.optionalString("arrivalBy")
            val date = Instant.parse(departure)
            require(arrival == null || !Instant.parse(arrival).isBefore(date))
            val price = checkNotNull(terms.optionalInt("priceCents")); require(price in 0..100_000)
            val driver = context["driverUserId"] as String; require(validId(driver))
            val seats = checkNotNull(context.optionalInt("seatsTotal")); require(seats in 1..8)
            val club = context.optionalString("clubId"); require(club == null || validId(club))
            val team = context.optionalString("teamId"); require(team == null || validId(team))
            val category = context.optionalString("category"); require(category == null || category.length <= 80)
            val radius = context.optionalInt("pickupRadiusM"); require(radius == null || radius in 100..10_000)
            val baggage = context.optionalString("baggage"); require(baggage == null || baggage in setOf("small", "medium", "large"))
            val revision = context.optionalString("appliedChangeId"); require(revision == null || Regex("[a-f0-9]{64}").matches(revision))
            BookingIntentSnapshot(departure, arrival, point(terms["origin"]), point(terms["destination"]), price, driver, seats,
                club, team, category, radius, baggage, context.optionalBoolean("returnTrip"),
                context.optionalBoolean("supportsVehicleTracking"), context.optionalBoolean("supportsChildTracking"), revision)
        }.getOrNull()

        private fun validId(value: String) = value.isNotEmpty() && value.length <= 256 && '/' !in value &&
            value !in setOf(".", "..") && !Regex("__.*__").matches(value)
        private fun point(value: Any?): MapPoint {
            val map = value as Map<*, *>
            val lat = (map["lat"] as Number).toDouble(); val lng = (map["lng"] as Number).toDouble()
            require(lat.isFinite() && lng.isFinite() && lat in -90.0..90.0 && lng in -180.0..180.0)
            return MapPoint(lat, lng)
        }
        private fun Map<*, *>.optionalString(key: String): String? = this[key]?.let { it as String }
        private fun Map<*, *>.optionalBoolean(key: String): Boolean? = this[key]?.let { it as Boolean }
        private fun Map<*, *>.optionalInt(key: String): Int? = this[key]?.let {
            val number = (it as Number).toDouble()
            require(number.isFinite() && number == number.toInt().toDouble())
            number.toInt()
        }
    }
}
