package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ClubSummary
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.util.Locale

internal class FirebaseAndroidGroupsGateway(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    suspend fun listClubSummaries(): List<ClubSummary> {
        val roleByClub = loadRoleByClub()
        val clubs = firestore.collection("clubs")
            .orderBy("name")
            .limit(50)
            .get()
            .await()

        return clubs.documents.map { document ->
            mapClubSummary(
                id = document.id,
                data = document.data.orEmpty(),
                role = roleByClub[document.id],
            )
        }
    }

    private suspend fun loadRoleByClub(): Map<String, String> {
        val uid = auth.currentUser?.uid ?: return emptyMap()
        val snapshot = firestore.collection("memberships")
            .whereEqualTo("userId", uid)
            .limit(50)
            .get()
            .await()

        return snapshot.documents.mapNotNull { document ->
            val data = document.data.orEmpty()
            val clubId = data["clubId"] as? String ?: return@mapNotNull null
            clubId to ((data["role"] as? String)?.uppercase(Locale.FRANCE) ?: "MEMBRE")
        }.toMap()
    }
}

private fun mapClubSummary(id: String, data: Map<String, Any>, role: String?): ClubSummary {
    val name = data["name"] as? String ?: data["displayName"] as? String ?: id
    return ClubSummary(
        id = id,
        name = name,
        sport = data["sport"] as? String ?: data["primarySport"] as? String ?: "Sport",
        memberCount = numberValue(data["memberCount"]) ?: numberValue(data["members"]) ?: 0,
        roleLabel = role,
        initials = initials(name),
        memberInitials = stringList(data["memberInitials"]),
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
