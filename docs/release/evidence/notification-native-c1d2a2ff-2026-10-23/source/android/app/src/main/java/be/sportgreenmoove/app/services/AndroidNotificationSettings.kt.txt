package be.sportgreenmoove.app.services

import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.provider.Settings

internal enum class NotificationSettingsResult { Opened, Unavailable, Denied }

internal fun notificationsAllowed(context: Context): Boolean =
    context.getSystemService(NotificationManager::class.java).areNotificationsEnabled()

internal fun notificationSettingsIntent(packageName: String): Intent =
    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)

internal fun openNotificationSettings(context: Context): NotificationSettingsResult = try {
    context.startActivity(notificationSettingsIntent(context.packageName))
    NotificationSettingsResult.Opened
} catch (_: ActivityNotFoundException) {
    NotificationSettingsResult.Unavailable
} catch (_: SecurityException) {
    NotificationSettingsResult.Denied
}
