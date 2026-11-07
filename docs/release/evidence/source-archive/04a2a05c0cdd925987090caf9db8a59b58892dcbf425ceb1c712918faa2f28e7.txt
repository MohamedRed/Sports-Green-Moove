package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

internal const val rejectedPrimaryBitmapScope = "rejected-primary-bitmap-diagnostic-not-accepted-evidence"

internal fun retainRejectedPrimaryBitmap(
    name: String,
    bitmap: Bitmap,
    colors: Set<Int>,
    enabled: Boolean = primaryCaptureDiagnosticsEnabled(),
    persist: (Bitmap, Set<Int>) -> Unit = { image, samples ->
        val directory = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),
            "rejected-primary-captures")
        writeRejectedPrimaryBitmap(directory, image, samples, java.lang.Long.toUnsignedString(System.nanoTime()))
    },
) {
    if (!enabled || name != "team-chat-confirmed.png") return
    try { persist(bitmap, colors) }
    catch (_: Throwable) { Log.w("SGMRejectedCapture", "Rejected bitmap diagnostic unavailable; original quality failure unchanged") }
}

internal fun writeRejectedPrimaryBitmap(directory: File, bitmap: Bitmap, colors: Set<Int>, id: String) {
    require(colors.size in 1..16)
    require(Regex("[0-9]{1,20}").matches(id))
    check(directory.isDirectory || directory.mkdirs())
    val stem = "team-chat-confirmed-$id"
    val image = File(directory, "$stem.png")
    val marker = File(directory, "$stem.json")
    check(!image.exists() && !marker.exists())
    check(image.createNewFile())
    image.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    val digest = MessageDigest.getInstance("SHA-256").digest(image.readBytes()).joinToString("") { "%02x".format(it) }
    val record = JSONObject().put("schemaVersion", 1).put("scope", rejectedPrimaryBitmapScope)
        .put("captureName", "team-chat-confirmed.png").put("imageFile", image.name).put("imageSha256", digest)
        .put("width", bitmap.width).put("height", bitmap.height)
        .put("sampleStride", 16).put("minimumDistinctSampledColorsExclusive", 16)
        .put("sampledColorCount", colors.size)
        .put("sampledColorsArgb", JSONArray(colors.map { "%08x".format(it) }.sorted()))
        .put("imageAccepted", false).put("flowVerified", false).put("replacementCaptureUsed", false)
        .put("recordedAtEpochMillis", System.currentTimeMillis())
    check(marker.createNewFile())
    marker.writeText(record.toString(2) + "\n")
}
