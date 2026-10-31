package be.sportgreenmoove.app.ui

import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.testing.WindowFocusSnapshot

internal object InputWindowDiagnostics {
    fun captureFailure() {
        try {
            val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
            val descriptor = automation.executeShellCommand("dumpsys -t 1 window displays")
            val bytes = ByteArray(128 * 1024)
            var used = 0
            ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { input ->
                while (used < bytes.size) {
                    val count = input.read(bytes, used, bytes.size - used)
                    if (count < 0) break
                    used += count
                }
            }
            val entries = WindowFocusSnapshot.sanitize(String(bytes, 0, used, Charsets.UTF_8))
            Log.i("SgmInputReadiness", "focus-owner-snapshot bounded=${used == bytes.size} observations=${entries.size}")
            entries.forEach { Log.i("SgmInputReadiness", "focus-owner $it") }
        } catch (_: Exception) {
            // Diagnostic failure must not replace the original focus assertion.
            Log.i("SgmInputReadiness", "focus-owner-snapshot unavailable")
        }
    }
}
