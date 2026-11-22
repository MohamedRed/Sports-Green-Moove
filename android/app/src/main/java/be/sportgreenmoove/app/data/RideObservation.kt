package be.sportgreenmoove.app.data

data class RideObservation(
    val vehicleAgeMs: Long?, val childAgeMs: Long?,
    val vehicleHasPoint: Boolean, val childHasPoint: Boolean,
    val vehicleSource: String?, val childSource: String?,
)

data class RideObservationUpdate(val ride: LiveRideSnapshot?, val requestDurationMs: Long)
