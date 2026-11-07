package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ReceivedRatingSummary
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidReceivedRatingsGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : ReceivedRatingsGateway {
    private fun requireSession(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Rating account changed")
    }
    override suspend fun readReceivedRatings(uid: String): ReceivedRatingSummary {
        requireSession(uid)
        val response = functions.getHttpsCallable("getReceivedRatingSummary").call(emptyMap<String, Any>()).await()
        requireSession(uid)
        return parseReceivedRatingSummary(response.data, uid)
    }
}

internal fun parseReceivedRatingSummary(raw: Any?, uid: String): ReceivedRatingSummary {
    val data = raw as? Map<*, *> ?: error("Invalid rating summary")
    check(data.keys == setOf("userId", "count", "average") && data["userId"] == uid)
    val count = (data["count"] as? Number)?.toDouble() ?: error("Missing rating count")
    check(count.isFinite() && count % 1.0 == 0.0 && count in 0.0..9_007_199_254_740_991.0)
    val average = data["average"]
    check(average == null || average is Number)
    return ReceivedRatingSummary(uid, count.toLong(), average?.toDouble())
}
