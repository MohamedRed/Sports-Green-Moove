package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

internal fun recordEmergencyDialerAttempt(context: Context, device: UiDevice, runId: String,
    resolvedComponent: String, appeared: Boolean, dialIntentCount: Int, directCallIntentCount: Int) {
    val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
    check(directory.isDirectory || directory.mkdirs())
    val capture = File(directory, "emergency-dialer-attempt.png")
    val captured = device.takeScreenshot(capture)
    val knownFeedback = listOf("Impossible de vérifier le contact. Actualisez.", "Aucune application téléphone disponible.",
        "Impossible d’ouvrir le téléphone.", "Le contact a changé. Vérifiez-le avant d’ouvrir le téléphone.",
        "Ouverture annulée.", "Téléphone ouvert.").filter { device.hasObject(By.text(it)) }
    val report = JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", runId)
        .put("scope", "read-only-local-dialer-attempt-diagnostic-not-flow-verification")
        .put("resolvedComponent", resolvedComponent).put("observedPackage", device.currentPackageName ?: JSONObject.NULL)
        .put("expectedPackageAppeared", appeared).put("dialIntentCount", dialIntentCount)
        .put("directCallIntentCount", directCallIntentCount).put("knownAppFeedback", JSONArray(knownFeedback))
        .put("captureWritten", captured).put("capture", if (captured) capture.name else JSONObject.NULL)
    File(directory, "emergency-dialer-attempt.json").writeText(report.toString(2))
}
