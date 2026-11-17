package be.sportgreenmoove.app.data

data class TripPublishDraft(
    val title: String,
    val sport: String,
    val clubName: String,
    val teamName: String,
    val clubId: String,
    val teamId: String,
    val category: String,
    val departureAtIso: String,
    val origin: ResolvedPlace,
    val destination: ResolvedPlace,
    val pickupRadiusM: Int,
    val seatsTotal: Int,
    val seatsAvailable: Int,
    val baggage: String,
    val returnTrip: Boolean,
    val priceCents: Int,
    val supportsVehicleTracking: Boolean,
    val supportsChildTracking: Boolean,
    val co2SavedKgEstimate: Double,
    val distanceKm: Double? = null,
)
