package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.isActiveClubMembership
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import java.util.Locale

private data class ClubMembershipState(
    val roleLabel: String?,
    val status: String?,
    val active: Boolean?,
)

internal class FirebaseAndroidGroupsGateway(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    suspend fun listClubSummaries(): List<ClubSummary> {
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("Sign-in required")
        val membershipByClub = loadMembershipByClub(uid)
        val clubs = firestore.collection("clubs")
            .orderBy("name")
            .limit(50)
            .get(Source.SERVER)
            .await()
        if (auth.currentUser?.uid != uid) throw CancellationException("Account changed during club refresh")

        return clubs.documents.map { document ->
            mapClubSummary(
                id = document.id,
                data = document.data.orEmpty(),
                membership = membershipByClub[document.id],
            )
        }
    }

    private suspend fun loadMembershipByClub(uid: String): Map<String, ClubMembershipState> {
        val snapshot = firestore.collection("memberships")
            .whereEqualTo("userId", uid)
            .limit(50)
            .get(Source.SERVER)
            .await()

        return snapshot.documents.mapNotNull { document ->
            val data = document.data.orEmpty()
            val clubId = data["clubId"] as? String ?: return@mapNotNull null
            val status = data["status"] as? String
            val active = data["active"] as? Boolean
            val role = if (!isActiveClubMembership(status, active)) {
                null
            } else {
                when (val role = data["role"] as? String) {
                    "member" -> "MEMBRE"
                    else -> role?.uppercase(Locale.FRANCE) ?: "MEMBRE"
                }
            }
            clubId to ClubMembershipState(roleLabel = role, status = status, active = active)
        }.toMap()
    }
}

private fun mapClubSummary(id: String, data: Map<String, Any>, membership: ClubMembershipState?): ClubSummary {
    val name = data["name"] as? String ?: data["displayName"] as? String ?: id
    return ClubSummary(
        id = id,
        name = name,
        sport = data["sport"] as? String ?: data["primarySport"] as? String ?: "Sport",
        memberCount = numberValue(data["memberCount"]) ?: numberValue(data["members"]) ?: 0,
        roleLabel = membership?.roleLabel,
        initials = initials(name),
        memberInitials = stringList(data["memberInitials"]),
        membershipStatus = membership?.status,
        membershipActive = membership?.active,
    )
}

private fun initials(value: String): String =
    value.split(Regex("\\s+"))
        .filter(String::isNotBlank)
        .take(2)
        .joinToString("") { it.first().uppercaseChar().toString() }
        .ifBlank { "CL" }

private fun numberValue(value: Any?): Int? =
    (value as? Number)?.toInt()

private fun stringList(value: Any?): List<String> =
    (value as? List<*>)
        ?.mapNotNull { it as? String }
        .orEmpty()
