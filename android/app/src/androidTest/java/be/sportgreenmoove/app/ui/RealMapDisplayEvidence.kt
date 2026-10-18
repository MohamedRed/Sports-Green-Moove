package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import java.io.File
import kotlin.math.ceil
import kotlin.math.floor

internal fun captureLoadedTripMap(compose: ComposeTestRule, tag: String): JSONObject {
    val map = compose.onNodeWithTag(tag)
    map.performScrollTo().assertIsDisplayed()
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
    check(directory.isDirectory || directory.mkdirs())
    try {
        compose.waitUntil(60_000) {
            map.fetchSemanticsNode().config.getOrNull(SemanticsProperties.StateDescription) == "Carte chargée"
        }
    } catch (failure: Throwable) {
        try {
            val timeoutScreen = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
            try {
                File(directory, "local-real-map-load-failed.png").outputStream().use {
                    check(timeoutScreen.compress(Bitmap.CompressFormat.PNG, 100, it))
                }
            } finally { timeoutScreen.recycle() }
        } catch (captureFailure: Throwable) { failure.addSuppressed(captureFailure) }
        throw failure
    }
    compose.waitForIdle()
    val node = map.fetchSemanticsNode()
    val root = checkNotNull(node.root as? ViewRootForTest)
    val position = IntArray(2)
    compose.runOnUiThread { root.view.getLocationOnScreen(position) }
    val bounds = node.boundsInRoot
    val left = floor(bounds.left).toInt() + position[0]
    val top = floor(bounds.top).toInt() + position[1]
    val width = ceil(bounds.right).toInt() - floor(bounds.left).toInt()
    val height = ceil(bounds.bottom).toInt() - floor(bounds.top).toInt()
    val screen = checkNotNull(instrumentation.uiAutomation.takeScreenshot()) { "Native display capture is required." }
    try {
        check(left >= 0 && top >= 0 && left + width <= screen.width && top + height <= screen.height)
        check(width >= 200 && height >= 200) { "The entire map must be visible." }
        File(directory, "local-real-map-display.png").outputStream().use {
            check(screen.compress(Bitmap.CompressFormat.PNG, 100, it))
        }
        val region = Bitmap.createBitmap(screen, left, top, width, height)
        try {
            File(directory, "local-real-map-region.png").outputStream().use {
                check(region.compress(Bitmap.CompressFormat.PNG, 100, it))
            }
            // Exclude controls, markers near the edge and attribution from the raster check.
            val bins = mutableMapOf<Int, Int>()
            for (y in height / 5 until height * 4 / 5 step 4) {
                for (x in width / 5 until width * 4 / 5 step 4) {
                    val pixel = region.getPixel(x, y)
                    val bin = ((pixel shr 20) and 15) shl 8 or (((pixel shr 12) and 15) shl 4) or ((pixel shr 4) and 15)
                    bins[bin] = (bins[bin] ?: 0) + 1
                }
            }
            val samples = bins.values.sum()
            val dominantFraction = bins.values.max().toDouble() / samples
            val evidence = JSONObject().put("sdkLoaded", true).put("anchorsFramed", true).put("capture", "native-display")
                .put("screenFile", "local-real-map-display.png").put("regionFile", "local-real-map-region.png")
                .put("left", left).put("top", top).put("width", width).put("height", height)
                .put("samples", samples).put("colorBins", bins.size).put("dominantFraction", dominantFraction)
            File(directory, "local-real-map-display.json").writeText(evidence.toString(2))
            check(samples > 1000 && bins.size >= 16 && dominantFraction < 0.85) { "Blank map raster rejected: $evidence" }
            return evidence
        } finally { region.recycle() }
    } finally { screen.recycle() }
}
