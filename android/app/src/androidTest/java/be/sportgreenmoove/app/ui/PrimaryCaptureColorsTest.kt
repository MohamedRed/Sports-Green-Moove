package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test

class PrimaryCaptureColorsTest {
    @Test fun flatAndExactlySixteenColorsStillFailTheSameThreshold() {
        val image = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        try {
            image.eraseColor(0xfffafafa.toInt())
            assertEquals(1, primaryCaptureColors(image).size)
            for (x in 1..15) image.setPixel(x, 1, 0xff000000.toInt() or x)
            assertEquals(16, primaryCaptureColors(image).size)
            assertFalse(primaryCaptureColors(image).size > 16)
        } finally { image.recycle() }
    }
    @Test fun seventeenActualColorsBetweenOldSamplePointsAreNotBlank() {
        val image = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        try {
            image.eraseColor(0xfffafafa.toInt())
            for (x in 1..16) image.setPixel(x, 1, 0xff000000.toInt() or x)
            assertEquals(1, rejectedBitmapSamples(image).size)
            assertEquals(17, primaryCaptureColors(image).size)
        } finally { image.recycle() }
    }
    @Test fun theOriginalRejectedEmptyStatePassesWithoutRecaptureOrPixelChanges() {
        val context = InstrumentationRegistry.getInstrumentation().context
        val image = context.assets.open("qa/notification-empty-state.png").use { BitmapFactory.decodeStream(it) }
        try {
            assertEquals(1080, image.width); assertEquals(2400, image.height)
            assertEquals(10, rejectedBitmapSamples(image).size)
            assertEquals(17, primaryCaptureColors(image).size)
        } finally { image.recycle() }
    }
}
