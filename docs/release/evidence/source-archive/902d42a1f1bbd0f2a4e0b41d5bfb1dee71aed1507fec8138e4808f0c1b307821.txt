package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.RideObservation

internal fun mapRideObservation(value: Any?): RideObservation? {
    if (value == null) return null
    val data = value as? Map<*, *> ?: error("Informations de suivi invalides.")
    fun age(key: String): Long? {
        check(data.containsKey(key)) { "Âge de position manquant." }
        val raw = data[key] ?: return null
        val number = (raw as? Number)?.toDouble() ?: error("Âge de position invalide.")
        check(number.isFinite() && number >= 0 && number <= 9_007_199_254_740_991.0 && number % 1.0 == 0.0)
        return number.toLong()
    }
    fun source(key: String): String? {
        check(data.containsKey(key)) { "Source de position manquante." }
        return data[key]?.let { raw ->
            check(raw in setOf("radar", "nativeFallback", "manual")) { "Source de position invalide." }
            raw as String
        }
    }
    return RideObservation(age("vehicleAgeMs"), age("childAgeMs"),
        data["vehicleHasPoint"] as? Boolean ?: error("État du véhicule manquant."),
        data["childHasPoint"] as? Boolean ?: error("État de l’enfant manquant."),
        source("vehicleSource"), source("childSource"))
}
