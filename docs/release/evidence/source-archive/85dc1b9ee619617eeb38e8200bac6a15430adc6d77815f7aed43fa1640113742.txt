package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.LiveRideSnapshot

internal fun ageRideObservation(ride: LiveRideSnapshot, elapsedMs: Long): LiveRideSnapshot {
    require(elapsedMs >= 0)
    val observation = requireNotNull(ride.observation) { "Informations de suivi manquantes." }
    fun age(value: Long?): Long? = value?.let { if (it > Long.MAX_VALUE - elapsedMs) Long.MAX_VALUE else it + elapsedMs }
    val vehicleAge = age(observation.vehicleAgeMs)
    return ride.copy(
        vehicleLastUpdateLabel = locationLabel(observation.vehicleHasPoint, vehicleAge, observation.vehicleSource, "En attente du premier point GPS"),
        childLastUpdateLabel = if (observation.childHasPoint) locationLabel(true, age(observation.childAgeMs), observation.childSource, "Enfant en attente") else null,
        stale = !observation.vehicleHasPoint || vehicleAge == null || vehicleAge > 90_000,
    )
}

private fun locationLabel(hasPoint: Boolean, age: Long?, source: String?, missing: String): String {
    if (!hasPoint) return missing
    if (age == null) return "Position à vérifier"
    val prefix = when (source) { "nativeFallback" -> "Secours GPS"; "manual" -> "Manuel"; else -> "GPS" }
    val seconds = age / 1_000
    val elapsed = when {
        seconds < 5 -> "à l’instant"
        seconds < 60 -> "il y a $seconds s"
        seconds < 3_600 -> "il y a ${seconds / 60} min"
        else -> "il y a ${seconds / 3_600} h"
    }
    return "$prefix · $elapsed"
}
