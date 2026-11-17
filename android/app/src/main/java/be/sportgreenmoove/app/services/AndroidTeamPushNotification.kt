package be.sportgreenmoove.app.services

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import be.sportgreenmoove.app.MainActivity

internal const val teamPushOpenAction = "be.sportgreenmoove.app.OPEN_TEAM_ALERT"
internal const val teamPushNotificationPrefix = "sgm-team-alert:"
internal fun teamPushWorkName(request: TeamPushOpenRequest) = teamPushNotificationPrefix +
    teamPushHash(request.uid) + ":" + request.epoch + ":" + request.notificationId

internal fun teamPushOpenIntent(context: Context, request: TeamPushOpenRequest) = Intent(context, MainActivity::class.java)
    .setAction(teamPushOpenAction)
    .setData(Uri.Builder().scheme("sgm-team-alert").authority("open").appendPath(request.notificationId)
        .appendQueryParameter("account", teamPushHash(request.uid)).appendQueryParameter("epoch", request.epoch.toString()).build())
    .putExtra("notificationId", request.notificationId).putExtra("ownerUid", request.uid).putExtra("epoch", request.epoch)
    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)

internal fun teamPushOpenRequest(intent: Intent?): TeamPushOpenRequest? {
    if (intent?.action != teamPushOpenAction) return null
    return try {
        TeamPushOpenRequest(intent.getStringExtra("notificationId") ?: return null,
            intent.getStringExtra("ownerUid") ?: return null, intent.getLongExtra("epoch", -1))
    } catch (_: IllegalArgumentException) { null }
    catch (_: android.os.BadParcelableException) { null }
}

internal fun postTeamPushNotification(context: Context, request: TeamPushOpenRequest) {
    check(teamNotificationsAllowed(context)) { "Team notifications are disabled" }
    val open = PendingIntent.getActivity(context, 0, teamPushOpenIntent(context, request),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = Notification.Builder(context, teamPushChannelId)
        .setSmallIcon(android.R.drawable.ic_dialog_email).setContentTitle(teamPushAlertTitle).setContentText(teamPushAlertBody)
        .setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE).build()
    context.getSystemService(NotificationManager::class.java).notify(teamPushWorkName(request), 0, notification)
}

internal fun clearTeamPushNotifications(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java)
    for (notification in manager.activeNotifications)
        if (notification.tag?.startsWith(teamPushNotificationPrefix) == true) manager.cancel(notification.tag, notification.id)
}
