package be.sportgreenmoove.app.ui

import android.graphics.BitmapFactory
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File

internal fun captureLocalUi(compose: ComposeTestRule, name: String) {
    compose.waitForIdle()
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
    check(directory.isDirectory || directory.mkdirs())
    val output = File(directory, name)
    check(UiDevice.getInstance(instrumentation).takeScreenshot(output))
    val bitmap = requireNotNull(BitmapFactory.decodeFile(output.path))
    try {
        val colors = mutableSetOf<Int>()
        for (x in 0 until bitmap.width step 16) {
            for (y in 0 until bitmap.height step 16) colors += bitmap.getPixel(x, y)
        }
        check(colors.size > 16) { "Blank test capture rejected; use a rendering-enabled device image." }
    } finally { bitmap.recycle() }
}
