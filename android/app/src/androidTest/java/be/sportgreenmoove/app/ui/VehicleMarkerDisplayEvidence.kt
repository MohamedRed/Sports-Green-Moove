package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import android.graphics.Rect
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import kotlin.math.ceil
import kotlin.math.floor

internal fun freshVehicleMarkerBounds(device: UiDevice): Rect? {
    check(InstrumentationRegistry.getInstrumentation().uiAutomation.clearCache()) {
        "The map accessibility snapshot must be refreshed before observing its markers"
    }
    val markers = device.findObjects(By.desc("Position du véhicule"))
    if (markers.size != 1) return null
    return markers.single().visibleBounds.takeIf { it.width() in 12..200 && it.height() in 12..240 }
}

private fun routeMarkerBounds(device: UiDevice, title: String): Rect {
    val markers = device.findObjects(By.desc(title))
    check(markers.size == 1) { "Expected one route anchor named $title, found ${markers.size}" }
    return markers.single().visibleBounds.also { check(it.width() in 12..200 && it.height() in 12..240) }
}

internal fun captureVehicleMarkerDisplay(compose: ComposeTestRule, device: UiDevice, label: String): JSONObject {
    check(label in setOf("first", "moved"))
    val map = compose.onNodeWithTag(SgmTestTags.GoogleMapsRoutePreview).assertIsDisplayed().fetchSemanticsNode()
    val root = checkNotNull(map.root as? ViewRootForTest)
    val location = IntArray(2)
    compose.runOnUiThread { root.view.getLocationOnScreen(location) }
    val bounds = map.boundsInRoot
    val region = Rect(floor(bounds.left).toInt() + location[0], floor(bounds.top).toInt() + location[1],
        ceil(bounds.right).toInt() + location[0], ceil(bounds.bottom).toInt() + location[1])
    val marker = checkNotNull(freshVehicleMarkerBounds(device)) { "The actual SDK vehicle marker is required" }
    check(region.contains(marker)) { "The whole vehicle marker must fit inside the visible map" }
    val departure = routeMarkerBounds(device, "Départ du trajet")
    val arrival = routeMarkerBounds(device, "Arrivée du trajet")
    check(region.contains(departure) && region.contains(arrival)) { "The route anchors must remain visible" }
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val screen = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
    try {
        check(region.left >= 0 && region.top >= 0 && region.right <= screen.width && region.bottom <= screen.height)
        val bins = mutableMapOf<Int, Int>()
        for (y in region.top + region.height() / 5 until region.bottom - region.height() / 5 step 4) {
            for (x in region.left + region.width() / 5 until region.right - region.width() / 5 step 4) {
                val p = screen.getPixel(x, y)
                val bin = ((p shr 20) and 15) shl 8 or (((p shr 12) and 15) shl 4) or ((p shr 4) and 15)
                bins[bin] = (bins[bin] ?: 0) + 1
            }
        }
        val samples = bins.values.sum(); val dominant = bins.values.max().toDouble() / samples
        check(samples > 1000 && bins.size >= 16 && dominant < 0.85) { "Blank or unloaded map rejected" }
        var greenPixels = 0
        for (y in marker.top until marker.bottom) for (x in marker.left until marker.right) {
            val p = screen.getPixel(x, y); val r = p shr 16 and 255; val g = p shr 8 and 255; val b = p and 255
            if (g > 100 && g > r * 1.4 && g > b * 1.4) greenPixels++
        }
        check(greenPixels >= 50) { "The fresh vehicle marker must contain its rendered green pin" }
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        check(directory.isDirectory || directory.mkdirs())
        val name = "local-vehicle-map-$label.png"; val file = File(directory, name); check(!file.exists())
        file.outputStream().use { check(screen.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        fun rectangle(value: Rect) = JSONObject().put("left", value.left).put("top", value.top)
            .put("right", value.right).put("bottom", value.bottom)
        return JSONObject().put("capture", "native-display").put("screenFile", name)
            .put("sha256", MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) })
            .put("mapBounds", rectangle(region)).put("markerBounds", rectangle(marker))
            .put("departureBounds", rectangle(departure)).put("arrivalBounds", rectangle(arrival))
            .put("samples", samples).put("colorBins", bins.size).put("dominantFraction", dominant).put("greenPixels", greenPixels)
    } finally { screen.recycle() }
}
