package be.sportgreenmoove.app.ui

import android.app.Activity
import android.os.Looper
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage

internal fun observedActivityStage(activity: Activity): Stage {
    check(Looper.myLooper() != Looper.getMainLooper()) { "Observe the activity from the instrumentation thread" }
    var stage: Stage? = null
    InstrumentationRegistry.getInstrumentation().runOnMainSync {
        stage = ActivityLifecycleMonitorRegistry.getInstance().getLifecycleStageOf(activity)
    }
    return checkNotNull(stage)
}
