package be.sportgreenmoove.app.services

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidTeamPushAlert(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
) {
    suspend fun resolve(lease: TeamPushAlertLease, notificationId: String, purpose: TeamPushAlertPurpose): Any? {
        if (auth.currentUser?.uid != lease.uid) throw TeamPushAlertUnavailableException()
        val value = try { functions.getHttpsCallable("resolveTeamPushAlert").call(lease.payload(notificationId, purpose)).await().data }
        catch (failure: FirebaseFunctionsException) {
            if (failure.code in setOf(FirebaseFunctionsException.Code.PERMISSION_DENIED, FirebaseFunctionsException.Code.UNAUTHENTICATED,
                    FirebaseFunctionsException.Code.FAILED_PRECONDITION)) throw TeamPushAlertUnavailableException()
            throw failure
        }
        if (auth.currentUser?.uid != lease.uid) throw TeamPushAlertUnavailableException()
        return value
    }
}
