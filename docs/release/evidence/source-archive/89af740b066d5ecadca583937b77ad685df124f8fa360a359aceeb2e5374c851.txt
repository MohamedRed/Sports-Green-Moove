package be.sportgreenmoove.app.data

data class VehicleMapPoint(val lat: Double, val lng: Double, val capturedAt: Long, val source: String) {
    init {
        require(lat.isFinite() && lat in -90.0..90.0 && lng.isFinite() && lng in -180.0..180.0)
        require(capturedAt in 1..9_007_199_254_740_991L)
        require(source in setOf("radar", "nativeFallback", "manual"))
    }
}
