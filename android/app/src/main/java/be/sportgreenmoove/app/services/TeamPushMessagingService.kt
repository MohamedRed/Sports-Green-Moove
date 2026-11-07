package be.sportgreenmoove.app.services

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class TeamPushMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (message.notification == null) AndroidTeamPushRuntime.received(applicationContext, message.data)
    }
    override fun onNewToken(token: String) {
        // Re-read the SDK token under the current account epoch; callback tokens have no account identity.
        AndroidTeamPushRuntime.tokenRefreshed(applicationContext)
    }
}
