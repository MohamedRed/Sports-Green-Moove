package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import kotlin.math.roundToInt

internal fun captureBookingDateViewport(compose: ComposeTestRule, name: String, screen: String, kind: String,
    dark: Boolean, width: Int, height: Int, density: Float, text: JSONObject) {
    check(name.matches(Regex("(requests|trips|payments)-(scheduled|unknown)-(light|dark)-(phone|wide)")))
    compose.waitForIdle()
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val device = UiDevice.getInstance(instrumentation)
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "booking-date-evidence")
        .also { check(it.isDirectory || it.mkdirs()) }
    val image = File(directory, "$name.png"); check(!image.exists())
    val bitmap = compose.onNodeWithTag("booking-date.viewport").captureToImage().asAndroidBitmap()
    try {
        check(bitmap.width == (width * density).roundToInt() && bitmap.height == (height * density).roundToInt())
        requireFeedbackImageHasVariation(bitmap)
        image.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    } finally { bitmap.recycle() }
    val window = File(directory, "$name-window.png"); check(!window.exists())
    check(device.takeScreenshot(window))
    fun sha(file: File) = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }
    val record = File(directory, "$name.json"); check(!record.exists())
    record.writeText(JSONObject().put("scope", "booking-date-components-not-transaction-or-physical-proof")
        .put("case", name).put("screen", screen).put("dateKind", kind).put("dark", dark)
        .put("widthDp", width).put("heightDp", height).put("density", density).put("fontScale", 1.3)
        .put("text", text).put("layoutAssertionsPassed", true).put("physicalDevice", false)
        .put("backendCalls", false).put("mapsRendered", false).put("productionWrites", false)
        .put("capturedAtEpochMillis", System.currentTimeMillis())
        .put("viewportSha256", sha(image)).put("windowSha256", sha(window)).put("completed", true).toString(2))
    exportFeedbackFiles(device, listOf(image, window, record), "sgm-booking-dates")
}
