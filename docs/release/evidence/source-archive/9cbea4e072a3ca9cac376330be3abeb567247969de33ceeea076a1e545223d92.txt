package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class RejectedPrimaryBitmapTest {
    @Test fun disabledAndOtherNamedCapturesDoNotPersistAnyImage() {
        val image = Bitmap.createBitmap(32, 48, Bitmap.Config.ARGB_8888)
        try {
            var calls = 0
            for ((name, enabled) in listOf("team-chat-confirmed.png" to false, "trip-change-test.png" to true)) {
                retainRejectedPrimaryBitmap(name, image, setOf(0), enabled) { _, _ -> calls++ }
            }
            assertEquals(0, calls)
        } finally { image.recycle() }
    }
    @Test fun theSameReturnedBitmapAndSamplesArePassedWithoutAnotherCapture() {
        val image = Bitmap.createBitmap(32, 48, Bitmap.Config.ARGB_8888)
        try {
            val colors = setOf(0); var calls = 0
            retainRejectedPrimaryBitmap("team-chat-confirmed.png", image, colors, true) { actual, samples ->
                calls++; assertSame(image, actual); assertSame(colors, samples)
            }
            assertEquals(1, calls); assertFalse(image.isRecycled)
        } finally { image.recycle() }
    }
    @Test fun persistenceFailureDoesNotReplaceTheOriginalImageQualityFailure() {
        val image = Bitmap.createBitmap(32, 48, Bitmap.Config.ARGB_8888)
        try {
            val failure = assertThrows(IllegalStateException::class.java) {
                retainRejectedPrimaryBitmap("team-chat-confirmed.png", image, setOf(0), true) { _, _ ->
                    error("Synthetic diagnostic write failure")
                }
                check(false) { "Blank test capture rejected; use a rendering-enabled device image." }
            }
            assertEquals("Blank test capture rejected; use a rendering-enabled device image.", failure.message)
        } finally { image.recycle() }
    }
    @Test fun rejectedPngAndDigestRemainSeparateFromAcceptedScreenshots() {
        val parent = InstrumentationRegistry.getInstrumentation().targetContext.cacheDir
        val directory = File(parent, "rejected-capture-fixture-${System.nanoTime()}")
        val image = Bitmap.createBitmap(32, 48, Bitmap.Config.ARGB_8888)
        try {
            writeRejectedPrimaryBitmap(directory, image, setOf(0), "1")
            val marker = JSONObject(File(directory, "team-chat-confirmed-1.json").readText())
            val png = File(directory, marker.getString("imageFile"))
            val decoded = BitmapFactory.decodeFile(png.absolutePath)
            try { assertEquals(32, decoded.width); assertEquals(48, decoded.height); assertEquals(0, decoded.getPixel(16, 16)) }
            finally { decoded.recycle() }
            assertEquals(rejectedPrimaryBitmapScope, marker.getString("scope"))
            assertEquals(1, marker.getInt("sampledColorCount")); assertEquals("00000000", marker.getJSONArray("sampledColorsArgb").getString(0))
            for (key in listOf("imageAccepted", "flowVerified", "replacementCaptureUsed")) assertFalse(marker.getBoolean(key))
            val digest = MessageDigest.getInstance("SHA-256").digest(png.readBytes()).joinToString("") { "%02x".format(it) }
            assertEquals(digest, marker.getString("imageSha256")); assertFalse(File(directory, "team-chat-confirmed.png").exists())
            val original = png.readBytes()
            assertThrows(IllegalStateException::class.java) { writeRejectedPrimaryBitmap(directory, image, setOf(0), "1") }
            assertArrayEquals(original, png.readBytes())
            assertThrows(IllegalArgumentException::class.java) { writeRejectedPrimaryBitmap(directory, image, (0..16).toSet(), "2") }
            assertThrows(IllegalArgumentException::class.java) { writeRejectedPrimaryBitmap(directory, image, setOf(0), "../unsafe") }
        } finally { image.recycle(); directory.deleteRecursively() }
    }
}
