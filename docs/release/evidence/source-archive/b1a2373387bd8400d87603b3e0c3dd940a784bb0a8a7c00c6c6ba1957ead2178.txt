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

internal fun captureFormFeedbackViewport(compose: ComposeTestRule, name: String, screen: String,
    dark: Boolean, width: Int, height: Int, density: Float, text: JSONObject) {
    check(name.matches(Regex("(auth|search|chat-error|chat-limit|chat-sending)-(light|dark)-(phone|wide)")))
    compose.waitForIdle()
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "form-feedback-evidence")
        .also { check(it.isDirectory || it.mkdirs()) }
    val image = File(directory, "form-$name.png"); check(!image.exists())
    val bitmap = compose.onNodeWithTag("form-feedback.viewport").captureToImage().asAndroidBitmap()
    try {
        check(bitmap.width == (width * density).roundToInt() && bitmap.height == (height * density).roundToInt())
        requireFeedbackImageHasVariation(bitmap)
        image.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    } finally { bitmap.recycle() }
    val device = UiDevice.getInstance(instrumentation)
    val window = File(directory, "form-$name-window.png"); check(!window.exists())
    check(device.takeScreenshot(window))
    fun sha(file: File) = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }
    val record = File(directory, "form-$name.json"); check(!record.exists())
    record.writeText(JSONObject().put("scope", "form-feedback-components-not-auth-search-or-message-delivery-proof")
        .put("case", name).put("screen", screen).put("dark", dark).put("widthDp", width).put("heightDp", height)
        .put("density", density).put("fontScale", 1.3).put("text", text).put("completed", true)
        .put("physicalDevice", false).put("backendCalls", false).put("mapsRendered", false).put("productionWrites", false)
        .put("capturedAtEpochMillis", System.currentTimeMillis()).put("viewportSha256", sha(image))
        .put("windowSha256", sha(window)).toString(2))
    exportFeedbackFiles(device, listOf(image, window, record), "sgm-feedback-text")
}
