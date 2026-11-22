package be.sportgreenmoove.app.services

import com.google.firebase.messaging.FirebaseMessagingService

class TeamPushMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // Re-read the SDK token under the current account epoch; callback tokens have no account identity.
        AndroidTeamPushRuntime.tokenRefreshed(applicationContext)
    }
}
