package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.ceil
import kotlin.math.floor

internal fun captureVehicleMapFailure(compose: ComposeTestRule, phase: String) {
    check(phase in setOf("login", "open-ride", "first-point", "moved-point", "sign-out"))
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val context = instrumentation.targetContext
    val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
    check(directory.isDirectory || directory.mkdirs())
    val screen = checkNotNull(instrumentation.uiAutomation.takeScreenshot())
    try {
        File(directory, "local-vehicle-map-failed.png").outputStream().use {
            check(screen.compress(Bitmap.CompressFormat.PNG, 100, it))
        }
    } finally { screen.recycle() }
    val report = JSONObject().put("scope", "failed-map-trial-not-positive-evidence").put("phase", phase)
    val nodes = compose.onAllNodesWithTag(SgmTestTags.GoogleMapsRoutePreview).fetchSemanticsNodes()
    report.put("mapNodeCount", nodes.size)
    val map = nodes.singleOrNull()
    if (map != null) {
        val root = checkNotNull(map.root as? ViewRootForTest)
        val location = IntArray(2)
        compose.runOnUiThread { root.view.getLocationOnScreen(location) }
        val b = map.boundsInRoot
        val region = Rect(floor(b.left).toInt() + location[0], floor(b.top).toInt() + location[1],
            ceil(b.right).toInt() + location[0], ceil(b.bottom).toInt() + location[1])
        report.put("mapBounds", rectangle(region))
        val states = JSONObject()
        for (label in listOf("Carte chargée", "Chargement de la carte")) states.put(label,
            compose.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, label),
                useUnmergedTree = true).fetchSemanticsNodes().size)
        report.put("mapStateCounts", states)
        fun snapshot(): JSONObject {
            val markerCounts = JSONObject()
            val device = UiDevice.getInstance(instrumentation)
            for (label in listOf("Départ du trajet", "Arrivée du trajet", "Position du véhicule")) {
                markerCounts.put(label, device.findObjects(By.desc(label)).size)
            }
            val collected = JSONArray()
            val window = instrumentation.uiAutomation.rootInActiveWindow
            val ownedWindow = window?.packageName?.toString() == context.packageName
            fun visit(node: AccessibilityNodeInfo, depth: Int) {
                if (depth > 30 || collected.length() >= 200) return
                val bounds = Rect(); node.getBoundsInScreen(bounds)
                if (node.packageName?.toString() == context.packageName && !bounds.isEmpty && region.contains(bounds)) {
                    collected.put(JSONObject().put("class", node.className?.toString())
                        .put("description", node.contentDescription?.toString()?.take(160))
                        .put("visible", node.isVisibleToUser).put("bounds", rectangle(bounds)))
                }
                for (index in 0 until node.childCount) node.getChild(index)?.let { visit(it, depth + 1) }
            }
            if (ownedWindow) visit(checkNotNull(window), 0)
            return JSONObject().put("ownedWindow", ownedWindow).put("routeMarkerCounts", markerCounts)
                .put("mapNodes", collected)
        }
        report.put("beforeCacheClear", snapshot())
        // Diagnose stale accessibility data only after the trial has already failed.
        report.put("accessibilityCacheCleared", instrumentation.uiAutomation.clearCache())
        report.put("afterCacheClear", snapshot())
    }
    File(directory, "local-vehicle-map-failure.json").writeText(report.toString(2))
}

private fun rectangle(bounds: Rect) = JSONObject().put("left", bounds.left).put("top", bounds.top)
    .put("right", bounds.right).put("bottom", bounds.bottom)
