package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.MapPoint
import be.sportgreenmoove.app.data.MapRoutePreview

internal fun mapRoutePreviewFromTripData(data: Map<*, *>): MapRoutePreview? {
    val start = mapPoint(data["origin"]) ?: return null
    val end = mapPoint(data["destination"]) ?: return null
    val encodedPolyline = data["encodedPolyline"] as? String
    return MapRoutePreview(start = start, end = end, encodedPolyline = encodedPolyline)
}

internal fun mapRoutePreviewFromMatchData(summary: Map<*, *>, route: Map<*, *>?): MapRoutePreview? {
    val preview = mapRoutePreviewFromTripData(summary) ?: mapRoutePreview(summary["mapPreview"])
    val encodedPolyline = route?.get("finalEncodedPolyline") as? String
    return if (encodedPolyline.isNullOrBlank()) {
        preview
    } else {
        preview?.copy(encodedPolyline = encodedPolyline)
    }
}

private fun mapRoutePreview(value: Any?): MapRoutePreview? {
    val data = value as? Map<*, *> ?: return null
    val start = mapPoint(data["start"]) ?: return null
    val end = mapPoint(data["end"]) ?: return null
    val encodedPolyline = data["encodedPolyline"] as? String
    return MapRoutePreview(start = start, end = end, encodedPolyline = encodedPolyline)
}

private fun mapPoint(value: Any?): MapPoint? {
    val data = value as? Map<*, *> ?: return null
    val lat = (data["lat"] as? Number)?.toDouble()
    val lng = (data["lng"] as? Number)?.toDouble()
    if (lat == null || lng == null) return null
    return MapPoint(lat = lat, lng = lng)
}
