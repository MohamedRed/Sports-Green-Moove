package be.sportgreenmoove.app.services

import android.os.Process
import android.util.Log
import be.sportgreenmoove.app.BuildConfig
import com.google.android.gms.tasks.Task
import com.google.firebase.functions.HttpsCallableResult
import java.util.concurrent.Executor
import org.json.JSONObject

internal object LocalSupportCallDiagnostics {
    private val enabled = BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && BuildConfig.SGM_LOCAL_SUPPORT_TRACE
    private val trace by lazy {
        SupportCallTrace(true, Process.myPid()) { fields -> Log.i("SgmQaSupport", JSONObject(fields).toString()) }
    }

    fun observe(requestId: String, task: Task<HttpsCallableResult>) {
        if (!enabled) return
        val terminal = trace.start(requestId) ?: return
        task.addOnCompleteListener(Executor { it.run() }) { completed ->
            terminal(when {
                completed.isCanceled -> SupportCallOutcome.CANCELLED
                completed.isSuccessful -> SupportCallOutcome.SUCCEEDED
                else -> SupportCallOutcome.FAILED
            })
        }
    }
}
