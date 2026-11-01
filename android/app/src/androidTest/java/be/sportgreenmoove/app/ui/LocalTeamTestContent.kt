package be.sportgreenmoove.app.ui

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.setContent
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidProviderSet

// Install the same isolated dependency at creation and recreation, before the first frame.
internal class LocalTeamTestContent(context: Context, private val providers: AndroidProviderSet) :
    Application.ActivityLifecycleCallbacks, AutoCloseable {
    private val application = context.applicationContext as Application
    init {
        check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
        application.registerActivityLifecycleCallbacks(this)
    }
    override fun onActivityPostCreated(activity: Activity, savedInstanceState: Bundle?) {
        if (activity is MainActivity) activity.setContent { SportsGreenMooveApp { providers } }
    }
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityResumed(activity: Activity) = Unit
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit
    override fun close() { application.unregisterActivityLifecycleCallbacks(this) }
}
