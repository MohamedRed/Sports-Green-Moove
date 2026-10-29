package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.data.PendingReviewPage
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidPendingReviewGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : PendingReviewGateway {
    override suspend fun loadPendingReviews(cursor: String): PendingReviewPage {
        require(cursor.isNotBlank())
        val uid = auth.currentUser?.uid ?: throw CancellationException("Review session ended")
        val response = functions.getHttpsCallable("getPendingReviews").call(mapOf("cursor" to cursor)).await()
        if (auth.currentUser?.uid != uid) throw CancellationException("Review account changed")
        return parsePendingReviewPage(response.data, uid).also { check(it.nextCursor != cursor) }
    }
}

internal fun parsePendingReviewPage(raw: Any?, uid: String): PendingReviewPage {
    val data = raw as? Map<*, *> ?: error("Invalid review page")
    check(uid.isNotBlank() && data.keys == setOf("userId", "items", "nextCursor") && data["userId"] == uid)
    val cursor = data["nextCursor"]
    check(cursor == null || cursor is String && cursor.length in 1..16_384 && cursor.matches(Regex("[A-Za-z0-9_-]+")))
    val rows = data["items"] as? List<*> ?: error("Missing reviews")
    check(rows.size <= 20)
    val items = rows.map { rawRow ->
        val row = rawRow as? Map<*, *> ?: error("Invalid review")
        fun field(key: String) = (row[key] as? String)?.takeIf { it.isNotBlank() } ?: error("Missing review $key")
        val ride = field("rideSessionId"); val target = field("ratedUserId"); val id = field("id")
        check(target != uid && id == "${ride}_${uid}_${target}")
        InboxReviewPrompt(id, ride, target, field("title"), field("prompt"), field("initials"), parseReviewTripContext(row))
    }
    check(items.map { it.id }.distinct().size == items.size)
    return PendingReviewPage(uid, items, cursor as String?)
}
