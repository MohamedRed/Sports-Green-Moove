package be.sportgreenmoove.app.ui

import android.graphics.Bitmap

internal fun primaryCaptureColors(bitmap: Bitmap): Set<Int> {
    val colors = mutableSetOf<Int>()
    val row = IntArray(bitmap.width)
    for (y in 0 until bitmap.height) {
        bitmap.getPixels(row, 0, bitmap.width, 0, y, bitmap.width, 1)
        for (color in row) {
            colors += color
            if (colors.size > 16) return colors
        }
    }
    return colors
}

internal fun rejectedBitmapSamples(bitmap: Bitmap): Set<Int> {
    val colors = mutableSetOf<Int>()
    for (x in 0 until bitmap.width step 16) {
        for (y in 0 until bitmap.height step 16) colors += bitmap.getPixel(x, y)
    }
    return colors
}
