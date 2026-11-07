package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.MapPoint
import be.sportgreenmoove.app.data.MapRoutePreview

object MapRoutePolyline {
    fun pointsFor(preview: MapRoutePreview): List<MapPoint> {
        val decoded = preview.encodedPolyline
            ?.takeIf(String::isNotBlank)
            ?.let(::decode)
            .orEmpty()
        return if (decoded.size >= 2) decoded else listOf(preview.start, preview.end)
    }

    fun decode(encoded: String): List<MapPoint> {
        val points = mutableListOf<MapPoint>()
        var index = 0
        var lat = 0
        var lng = 0

        while (index < encoded.length) {
            val latitude = decodeValue(encoded, index)
            index = latitude.nextIndex
            val longitude = decodeValue(encoded, index)
            index = longitude.nextIndex
            lat += latitude.delta
            lng += longitude.delta
            points += MapPoint(lat = lat / 100_000.0, lng = lng / 100_000.0)
        }

        return points
    }

    private fun decodeValue(encoded: String, startIndex: Int): DecodedValue {
        var result = 0
        var shift = 0
        var index = startIndex
        var byte: Int

        do {
            require(index < encoded.length) { "Invalid encoded polyline." }
            byte = encoded[index++].code - 63
            result = result or ((byte and 0x1f) shl shift)
            shift += 5
        } while (byte >= 0x20)

        val delta = if ((result and 1) != 0) (result shr 1).inv() else result shr 1
        return DecodedValue(delta = delta, nextIndex = index)
    }

    private data class DecodedValue(
        val delta: Int,
        val nextIndex: Int,
    )
}
