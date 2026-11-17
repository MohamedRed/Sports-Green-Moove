package be.sportgreenmoove.app.ui

import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File

internal fun captureChildAccountWindow(name: String) {
    check(Regex("child-(account|emergency)-[a-z-]+\\.png").matches(name))
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
    check(directory.isDirectory || directory.mkdirs())
    val file = File(directory, name); check(!file.exists())
    val device = UiDevice.getInstance(instrumentation)
    check(device.takeScreenshot(file))
    device.executeShellCommand("mkdir -p /sdcard/Download/sgm-child-emergency-components")
    device.executeShellCommand("cp ${file.absolutePath} /sdcard/Download/sgm-child-emergency-components/$name")
}
