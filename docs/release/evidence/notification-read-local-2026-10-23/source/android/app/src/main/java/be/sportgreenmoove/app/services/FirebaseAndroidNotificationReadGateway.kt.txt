package be.sportgreenmoove.app.services

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidNotificationReadGateway(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
) : NotificationReadGateway {
    override suspend fun markNotificationRead(uid: String, notificationId: String) {
        check(auth.currentUser?.uid == uid) { "Notification account changed" }
        val receipt = functions.getHttpsCallable("markNotificationRead")
            .call(mapOf("userId" to uid, "notificationId" to notificationId)).await().data
        check(auth.currentUser?.uid == uid) { "Notification account changed" }
        requireNotificationReadReceipt(receipt, uid, notificationId)
    }
}

internal fun requireNotificationReadReceipt(value: Any?, uid: String, notificationId: String) {
    val receipt = value as? Map<*, *>
    if (receipt?.get("userId") != uid || receipt["notificationId"] != notificationId || receipt["read"] != true) {
        throw ProviderConfigurationException("Lecture de la notification non confirmée.")
    }
}
