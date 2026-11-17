package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.printToString
import androidx.compose.ui.text.TextLayoutResult
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

internal fun retainFeedbackLayoutDiagnostics(compose: ComposeTestRule, name: String, tags: List<String>) {
    compose.waitForIdle()
    val rows = JSONArray()
    for (tag in tags) {
        val node = compose.onNodeWithTag(tag)
        val layouts = mutableListOf<TextLayoutResult>()
        node.performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        val bounds = node.fetchSemanticsNode().boundsInRoot
        rows.put(JSONObject().put("tag", tag).put("bounds", bounds.toString()).put("layouts", JSONArray().apply {
            for (layout in layouts) put(JSONObject().put("widthPx", layout.size.width).put("heightPx", layout.size.height)
                .put("lineCount", layout.lineCount).put("overflowWidth", layout.didOverflowWidth)
                .put("overflowHeight", layout.didOverflowHeight).put("constraints", layout.layoutInput.constraints.toString()))
        }))
    }
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "feedback-layout-diagnostics")
        .also { check(it.isDirectory || it.mkdirs()) }
    val viewport = File(directory, "$name.png"); check(!viewport.exists())
    val bitmap = compose.onNodeWithTag("feedback.viewport").captureToImage().asAndroidBitmap()
    try { viewport.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) } }
    finally { bitmap.recycle() }
    val device = UiDevice.getInstance(instrumentation)
    val window = File(directory, "$name-window.png"); check(!window.exists())
    check(device.takeScreenshot(window))
    val record = File(directory, "$name.json"); check(!record.exists())
    record.writeText(JSONObject().put("scope", "pre-assertion-layout-diagnostic-not-accepted-evidence")
        .put("case", name).put("assertionsPassed", false).put("textLayouts", rows)
        .put("semantics", compose.onRoot(useUnmergedTree = true).printToString())
        .put("physicalDevice", false).put("backendCalls", false).put("releaseAccepted", false).toString(2))
    exportFeedbackFiles(device, listOf(viewport, window, record), "sgm-feedback-diagnostics")
}
