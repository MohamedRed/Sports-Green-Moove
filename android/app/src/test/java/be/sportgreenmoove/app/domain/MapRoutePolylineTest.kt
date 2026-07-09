package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.MapPoint
import be.sportgreenmoove.app.data.MapRoutePreview
import org.junit.Assert.assertEquals
import org.junit.Test

class MapRoutePolylineTest {
    @Test
    fun decodesGoogleEncodedPolyline() {
        val points = MapRoutePolyline.decode("_p~iF~ps|U_ulLnnqC_mqNvxq`@")

        assertEquals(3, points.size)
        assertPoint(points[0], 38.5, -120.2)
        assertPoint(points[1], 40.7, -120.95)
        assertPoint(points[2], 43.252, -126.453)
    }

    @Test
    fun fallsBackToEndpointsWhenPolylineIsMissing() {
        val preview = MapRoutePreview(
            start = MapPoint(lat = 50.716, lng = 4.611),
            end = MapPoint(lat = 50.671, lng = 4.581),
        )

        assertEquals(listOf(preview.start, preview.end), MapRoutePolyline.pointsFor(preview))
    }

    private fun assertPoint(point: MapPoint, lat: Double, lng: Double) {
        assertEquals(lat, point.lat, 0.00001)
        assertEquals(lng, point.lng, 0.00001)
    }
}
