package be.sportgreenmoove.app.ui

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onRoot
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File

internal fun captureLocalUi(compose: ComposeTestRule, name: String, landscape: Boolean = false) {
    compose.waitForIdle()
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
    check(directory.isDirectory || directory.mkdirs())
    val output = File(directory, name)
    // Capture the synchronized Compose window rather than a stale display buffer.
    val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
    try {
        check((bitmap.width > bitmap.height) == landscape) { "Capture orientation does not match the tested layout." }
        val colors = mutableSetOf<Int>()
        for (x in 0 until bitmap.width step 16) {
            for (y in 0 until bitmap.height step 16) colors += bitmap.getPixel(x, y)
        }
        check(colors.size > 16) { "Blank test capture rejected; use a rendering-enabled device image." }
        output.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    } finally { bitmap.recycle() }
}
