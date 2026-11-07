package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import org.json.JSONObject
import java.io.Closeable
import java.io.File

internal class LocalRideFailureObservation(private val context: Context, device: UiDevice, session: JSONObject) : Closeable {
    private val runId = session.getString("runId")
    private val observer: ActivityWindowObservation

    init {
        check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(FirebaseApp.getInstance().options.projectId == "demo-sgm-local-qa")
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(runId.matches(Regex("[a-f0-9]{32}")))
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        observer = ActivityWindowObservation(MainActivity::class.java)
    }

    fun phase(value: GuardianWindowPhase) = observer.phase(value)

    fun retainFailure(scenarioState: String) {
        check(scenarioState in setOf("DESTROYED", "INITIALIZED", "CREATED", "STARTED", "RESUMED"))
        val directory = File(requireNotNull(context.getExternalFilesDir(null)), "local-ui-evidence")
        check(directory.isDirectory || directory.mkdirs())
        val file = File(directory, "ride-window-failure-before-close.json")
        check(!file.exists())
        val report = observer.snapshot().put("projectId", "demo-sgm-local-qa").put("runId", runId)
            .put("scenarioState", scenarioState)
            .put("parentAuthenticated", FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent")
            .put("flowAccepted", false).put("repairAccepted", false).put("captureAccepted", false)
            .put("authenticationRetried", false).put("deadlinesChanged", false)
        file.writeText(report.toString(2))
    }

    override fun close() = observer.close()
}
