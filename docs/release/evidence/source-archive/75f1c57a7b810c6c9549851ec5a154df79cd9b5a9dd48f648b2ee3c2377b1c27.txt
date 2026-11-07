package be.sportgreenmoove.app.ui

internal fun routeMapAnchorsFit(points: List<Pair<Int, Int>>, width: Int, height: Int, padding: Int): Boolean {
    if (points.isEmpty() || padding <= 0 || width <= padding * 2 || height <= padding * 2) return false
    // Screen projection rounds to integer pixels at the fitted boundary.
    val inset = padding - 1
    return points.all { (x, y) -> x in inset..(width - inset) && y in inset..(height - inset) }
}
