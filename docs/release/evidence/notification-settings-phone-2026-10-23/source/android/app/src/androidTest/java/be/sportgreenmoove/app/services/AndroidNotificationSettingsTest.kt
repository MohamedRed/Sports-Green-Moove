package be.sportgreenmoove.app.services

import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.provider.Settings
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test

class AndroidNotificationSettingsTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test fun thePermissionReaderUsesTheCurrentSystemAppPermission() {
        assertEquals(context.getSystemService(NotificationManager::class.java).areNotificationsEnabled(), notificationsAllowed(context))
    }
    @Test fun openingTargetsOnlyThisAppsNotificationSettings() {
        var seen: Intent? = null
        val capture = object : ContextWrapper(context) {
            override fun startActivity(intent: Intent) { seen = intent }
        }
        assertEquals(NotificationSettingsResult.Opened, openNotificationSettings(capture))
        assertEquals(Settings.ACTION_APP_NOTIFICATION_SETTINGS, seen?.action)
        assertEquals(context.packageName, seen?.getStringExtra(Settings.EXTRA_APP_PACKAGE))
        assertNull(seen?.data); assertEquals(setOf(Settings.EXTRA_APP_PACKAGE), seen?.extras?.keySet())
    }
    @Test fun missingActivityDoesNotLaunchAnUnrelatedFallback() {
        var attempts = 0
        val unavailable = object : ContextWrapper(context) {
            override fun startActivity(intent: Intent) { attempts++; throw ActivityNotFoundException() }
        }
        assertEquals(NotificationSettingsResult.Unavailable, openNotificationSettings(unavailable)); assertEquals(1, attempts)
    }
    @Test fun deniedActivityDoesNotLaunchAnUnrelatedFallback() {
        var attempts = 0
        val denied = object : ContextWrapper(context) {
            override fun startActivity(intent: Intent) { attempts++; throw SecurityException() }
        }
        assertEquals(NotificationSettingsResult.Denied, openNotificationSettings(denied)); assertEquals(1, attempts)
    }
}
