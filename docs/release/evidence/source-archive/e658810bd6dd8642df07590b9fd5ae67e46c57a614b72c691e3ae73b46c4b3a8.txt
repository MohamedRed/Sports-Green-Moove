package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

internal fun captureTeamChatComponent(compose: ComposeTestRule, stem: String, scope: String, landscape: Boolean) {
    captureLocalUi(compose, "$stem.png", landscape = landscape)
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
    val window = File(directory, "$stem-window.png")
    val device = UiDevice.getInstance(instrumentation)
    check(device.takeScreenshot(window))
    fun sha(file: File) = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it) }
    File(directory, "$stem.json").writeText(JSONObject().put("scope", scope).put("case", stem).put("completed", true)
        .put("capturedAtEpochMillis", System.currentTimeMillis()).put("imageSha256", sha(File(directory, "$stem.png")))
        .put("windowSha256", sha(window)).toString(2))
    check(device.executeShellCommand("mkdir -p /sdcard/Download/sgm-team-chat-components").isBlank())
    for (name in listOf("$stem.png", "$stem-window.png", "$stem.json"))
        check(device.executeShellCommand("cp ${File(directory, name).absolutePath} /sdcard/Download/sgm-team-chat-components/$name").isBlank())
}
