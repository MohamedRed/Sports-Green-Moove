package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ProfileCity
import be.sportgreenmoove.app.data.ProfileCityChange
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidProfileCityGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : ProfileCityGateway {
    private fun requireSession(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Profile account changed")
    }
    private suspend fun call(uid: String, name: String, payload: Map<String, Any?>): ProfileCity {
        requireSession(uid)
        val result = functions.getHttpsCallable(name).call(payload).await()
        requireSession(uid)
        return parseProfileCity(result.data, uid)
    }
    override suspend fun readProfileCity(uid: String) = call(uid, "getProfileCity", emptyMap())
    override suspend fun saveProfileCity(uid: String, change: ProfileCityChange) = call(uid, "saveProfileCity",
        mapOf("city" to change.city, "expectedRevision" to change.expectedRevision, "requestId" to change.requestId))
}

internal fun parseProfileCity(raw: Any?, uid: String): ProfileCity {
    val data = raw as? Map<*, *> ?: error("Invalid city response")
    check(data.keys == setOf("userId", "city", "revision") && data["userId"] == uid)
    val revision = (data["revision"] as? Number)?.toDouble() ?: error("Invalid city revision")
    check(revision.isFinite() && revision % 1.0 == 0.0 && revision in 0.0..9_007_199_254_740_991.0)
    val city = data["city"]
    check(city == null || city is String)
    return ProfileCity(uid, city, revision.toLong())
}
