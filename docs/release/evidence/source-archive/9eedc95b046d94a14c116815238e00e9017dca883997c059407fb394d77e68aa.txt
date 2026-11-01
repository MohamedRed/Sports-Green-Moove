package be.sportgreenmoove.app.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging

internal const val teamPushChannelId = "team_messages"
internal fun createTeamPushChannel(context: Context) {
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(teamPushChannelId, "Messages d’équipe", NotificationManager.IMPORTANCE_DEFAULT))
}
internal fun teamNotificationsAllowed(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    return manager.areNotificationsEnabled() && manager.getNotificationChannel(teamPushChannelId)?.importance
        ?.let { it != NotificationManager.IMPORTANCE_NONE } == true
}

@Suppress("DEPRECATION")
internal fun firebaseTeamPushTokenSource(): TeamPushTokenSource = QueuedTeamPushTokenSource(
    { FirebaseMessaging.getInstance().isAutoInitEnabled = it },
    { FirebaseMessaging.getInstance().token },
    { FirebaseMessaging.getInstance().deleteToken() },
)
