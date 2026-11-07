package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.VehicleMapPoint

internal fun mapVehicleMapPoint(value: Any?): VehicleMapPoint? {
    if (value == null) return null
    val data = value as? Map<*, *> ?: error("Position du véhicule invalide.")
    fun number(key: String) = (data[key] as? Number)?.toDouble() ?: error("Coordonnées du véhicule invalides.")
    val captured = number("capturedAt")
    check(captured.isFinite() && captured in 1.0..9_007_199_254_740_991.0 && captured % 1.0 == 0.0)
    return VehicleMapPoint(number("lat"), number("lng"), captured.toLong(),
        data["source"] as? String ?: error("Source du véhicule manquante."))
}
