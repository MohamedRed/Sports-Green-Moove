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

internal fun captureNeutralTextViewport(compose: ComposeTestRule, name: String, screen: String,
    dark: Boolean, width: Int, height: Int, density: Float) {
    check(name.matches(Regex("(search|trips)-(light|dark)-(phone|wide)")))
    compose.waitForIdle()
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val device = UiDevice.getInstance(instrumentation)
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "neutral-text-evidence")
        .also { check(it.isDirectory || it.mkdirs()) }
    val image = File(directory, "$name.png"); check(!image.exists())
    val bitmap = compose.onNodeWithTag("contrast.viewport").captureToImage().asAndroidBitmap()
    try {
        check(bitmap.width == (width * density).roundToInt() && bitmap.height == (height * density).roundToInt())
        val colors = mutableSetOf<Int>()
        for (x in 0 until bitmap.width step 16) for (y in 0 until bitmap.height step 16) colors.add(bitmap.getPixel(x, y))
        check(colors.size > 16) { "Blank component capture rejected" }
        image.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    } finally { bitmap.recycle() }
    val window = File(directory, "$name-window.png"); check(!window.exists())
    check(device.takeScreenshot(window))
    fun sha(file: File) = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }
    val record = File(directory, "$name.json"); check(!record.exists())
    record.writeText(JSONObject().put("scope", "executed-local-neutral-text-components-not-full-app-or-physical")
        .put("case", name).put("screen", screen).put("dark", dark).put("widthDp", width).put("heightDp", height)
        .put("density", density).put("fontScale", 1.3).put("physicalDevice", false)
        .put("capturedAtEpochMillis", System.currentTimeMillis())
        .put("viewportSha256", sha(image)).put("windowSha256", sha(window)).put("completed", true).toString(2))
    check(device.executeShellCommand("mkdir -p /sdcard/Download/sgm-neutral-text").isBlank())
    for (file in listOf(image, window, record)) {
        check(Regex("[A-Za-z0-9/_.-]+").matches(file.absolutePath))
        val target = "/sdcard/Download/sgm-neutral-text/${file.name}"
        check(device.executeShellCommand("cp -n ${file.absolutePath} $target").isBlank())
        val observed = device.executeShellCommand("sha256sum $target").trim().split(Regex("\\s+"))
        check(observed.size == 2 && observed[0] == sha(file) && observed[1] == target)
    }
}
