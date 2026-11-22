package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import android.graphics.Color
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FeedbackCaptureSamplingTest {
    @Test fun detailBetweenCoarseGridPointsIsNotRejectedAsBlank() {
        val bitmap = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
        try {
            bitmap.eraseColor(Color.BLACK)
            for (x in 1..17) bitmap.setPixel(x, 1, Color.rgb(x, 0, 0))
            val coarse = mutableSetOf<Int>()
            for (y in 0 until 32 step 16) for (x in 0 until 32 step 16) coarse.add(bitmap.getPixel(x, y))
            assertEquals(1, coarse.size)
            requireFeedbackImageHasVariation(bitmap)
        } finally { bitmap.recycle() }
    }

    @Test fun aMonochromeImageIsStillRejected() {
        val bitmap = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
        try {
            bitmap.eraseColor(Color.BLACK)
            assertThrows(IllegalStateException::class.java) { requireFeedbackImageHasVariation(bitmap) }
        } finally { bitmap.recycle() }
    }
}
