package be.sportgreenmoove.app.ui

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry

internal interface PrimaryCaptureObservation {
    fun complete(failure: Throwable?, operationStartedAtNs: Long, operationCompletedAtNs: Long)
    fun close()
}

internal fun primaryCaptureDiagnosticsEnabled(): Boolean {
    val value = InstrumentationRegistry.getArguments().getString("sgmPrimaryCaptureDiagnostics")
    check(value == null || value in setOf("true", "false"))
    return value == "true"
}

internal fun <T> observePrimaryCapture(
    name: String,
    enabled: Boolean = primaryCaptureDiagnosticsEnabled(),
    createObservation: (String) -> PrimaryCaptureObservation = ::PrimaryCaptureProbe,
    operation: () -> T,
): T {
    if (!enabled || !name.startsWith("trip-change-")) return operation()
    val observation = createObservation(name)
    var primaryFailure: Throwable? = null
    val operationStartedAt = System.nanoTime()
    try {
        return operation()
    } catch (failure: Throwable) {
        primaryFailure = failure
        throw failure
    } finally {
        val operationCompletedAt = System.nanoTime()
        try {
            try { observation.complete(primaryFailure, operationStartedAt, operationCompletedAt) }
            finally { observation.close() }
        } catch (diagnosticFailure: Throwable) {
            if (primaryFailure !== diagnosticFailure) primaryFailure?.addSuppressed(diagnosticFailure)
            Log.w("SGMPrimaryCapture", "Diagnostic finalization failed; primary result unchanged")
        }
    }
}
