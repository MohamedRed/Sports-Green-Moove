package be.sportgreenmoove.app.ui

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import androidx.compose.ui.platform.AbstractComposeView
import androidx.compose.ui.platform.ViewRootForTest
import androidx.test.runner.lifecycle.ActivityLifecycleCallback
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import org.json.JSONArray
import org.json.JSONObject
import java.io.Closeable
import java.lang.ref.WeakReference
import java.util.ArrayDeque
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

internal enum class GuardianWindowPhase {
    Launching, ParentLogin, ParentHomeObserved, ParentProfileAction, ParentProfileActionReturned,
    ParentClubAction, ParentGuardianAction, ParentScenario, AccountSwitch, DriverLogin,
    DriverHomeObserved, DriverProfileAction, DriverProfileActionReturned, DriverClubAction,
    DriverGuardianAction, DriverScenario,
}

internal class ActivityWindowObservation(private val target: Class<out Activity>) : Closeable {
    private val handler = Handler(Looper.getMainLooper())
    private val events = ArrayDeque<JSONObject>()
    private val draws = AtomicLong()
    private var dropped = 0
    private var activity = WeakReference<Activity>(null)
    private var decor: View? = null
    @Volatile private var phase = GuardianWindowPhase.Launching
    @Volatile private var closed = false
    private var registrationFailure: String? = null
    private val attachment = object : View.OnAttachStateChangeListener {
        override fun onViewAttachedToWindow(view: View) = event("attached")
        override fun onViewDetachedFromWindow(view: View) = event("detached")
    }
    private val focus = ViewTreeObserver.OnWindowFocusChangeListener { focused ->
        event(if (focused) "focused" else "unfocused")
    }
    private val draw = ViewTreeObserver.OnDrawListener { if (!closed) draws.incrementAndGet() }
    private val lifecycle = ActivityLifecycleCallback { current, stage ->
        try {
            if (!closed && current.javaClass == target) {
                if (stage == Stage.CREATED || stage == Stage.RESUMED || activity.get() == null) activity = WeakReference(current)
                if (stage in setOf(Stage.CREATED, Stage.RESUMED) && decor !== current.window.decorView) attach(current.window.decorView)
                event("lifecycle", stage.name, System.identityHashCode(current))
            }
        } catch (failure: Exception) {
            event("callback-unavailable", failureClass = failure.javaClass.simpleName)
        }
    }

    init {
        try { onMain { if (!closed) ActivityLifecycleMonitorRegistry.getInstance().addLifecycleCallback(lifecycle) } }
        catch (failure: Exception) { registrationFailure = failure.javaClass.simpleName }
    }

    fun phase(value: GuardianWindowPhase) {
        check(!closed)
        phase = value
        event("phase")
    }

    fun snapshot(): JSONObject {
        check(!closed)
        val result = JSONObject().put("scope", "read-only-window-before-activity-close-not-flow-or-repair")
            .put("phase", phase.name).put("elapsedRealtimeMs", SystemClock.elapsedRealtime())
            .put("registrationObserved", registrationFailure == null)
            .put("registrationFailureClass", registrationFailure ?: JSONObject.NULL)
        try { result.put("window", onMain { windowSnapshot() }).put("mainThreadObserved", true) }
        catch (failure: Exception) {
            result.put("mainThreadObserved", false).put("observationFailureClass", failure.javaClass.simpleName)
        }
        synchronized(events) {
            result.put("events", JSONArray(events.toList())).put("droppedEvents", dropped)
        }
        return result.put("framesObserved", draws.get())
    }

    val eventCount: Int get() = synchronized(events) { events.size }

    private fun windowSnapshot(): JSONObject {
        val current = activity.get()
        val result = JSONObject().put("activityObserved", current != null)
        if (current == null) return result
        val view = current.window.decorView
        result.put("stage", ActivityLifecycleMonitorRegistry.getInstance().getLifecycleStageOf(current).name)
            .put("instanceId", System.identityHashCode(current))
            .put("finishing", current.isFinishing).put("destroyed", current.isDestroyed)
            .put("decorAttached", view.isAttachedToWindow).put("decorShown", view.isShown)
            .put("windowFocused", view.hasWindowFocus()).put("windowVisibility", view.windowVisibility)
        val queue = ArrayDeque<View>().apply { add(view) }
        var visited = 0; var hosts = 0; var owners = 0; var attachedOwners = 0; var truncated = false
        while (queue.isNotEmpty() && visited < 512) {
            val item = queue.removeFirst(); visited++
            if (item is AbstractComposeView) hosts++
            if (item is ViewRootForTest) { owners++; if (item.view.isAttachedToWindow) attachedOwners++ }
            if (item is ViewGroup) {
                val available = (512 - visited - queue.size).coerceAtLeast(0)
                if (item.childCount > available) truncated = true
                repeat(minOf(item.childCount, available)) { queue.add(item.getChildAt(it)) }
            }
        }
        return result.put("visitedViews", visited).put("treeTruncated", truncated || queue.isNotEmpty())
            .put("composeHosts", hosts).put("composeOwners", owners).put("attachedComposeOwners", attachedOwners)
    }

    private fun attach(view: View) {
        detach()
        decor = view
        view.addOnAttachStateChangeListener(attachment)
        view.viewTreeObserver.addOnWindowFocusChangeListener(focus)
        view.viewTreeObserver.addOnDrawListener(draw)
    }

    private fun detach() {
        val previous = decor; decor = null
        previous?.removeOnAttachStateChangeListener(attachment)
        previous?.viewTreeObserver?.takeIf { it.isAlive }?.let {
            it.removeOnWindowFocusChangeListener(focus); it.removeOnDrawListener(draw)
        }
    }

    private fun event(kind: String, stage: String? = null, instanceId: Int? = null, failureClass: String? = null) {
        if (closed) return
        val item = JSONObject().put("kind", kind).put("phase", phase.name)
            .put("elapsedRealtimeMs", SystemClock.elapsedRealtime())
        if (stage != null) item.put("stage", stage)
        if (instanceId != null) item.put("instanceId", instanceId)
        if (failureClass != null) item.put("failureClass", failureClass)
        synchronized(events) {
            if (events.size == 48) { events.removeFirst(); dropped++ }
            events.add(item)
        }
    }

    private fun <T> onMain(action: () -> T): T {
        if (Looper.myLooper() == Looper.getMainLooper()) return action()
        val task = FutureTask<T> { action() }
        check(handler.post(task))
        try { return task.get(2, TimeUnit.SECONDS) }
        finally { handler.removeCallbacks(task); if (!task.isDone) task.cancel(false) }
    }

    override fun close() {
        if (closed) return
        closed = true
        onMain { ActivityLifecycleMonitorRegistry.getInstance().removeLifecycleCallback(lifecycle); detach() }
    }
}
