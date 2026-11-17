package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ConversationBookingPage
import be.sportgreenmoove.app.data.ConversationDirectoryPage
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidConversationDirectory(
    private val firestore: FirebaseFirestore, private val functions: FirebaseFunctions, private val auth: FirebaseAuth,
) {
    fun observeChanges(): Flow<Unit> = flow {
        val uid = currentUid()
        val conversations = changes(firestore.collection("chatInboxes").whereEqualTo("userId", uid)
            .orderBy("lastMessageAt", Query.Direction.DESCENDING).limit(21), uid)
        val notifications = changes(firestore.collection("notifications").whereEqualTo("userId", uid)
            .orderBy("createdAt", Query.Direction.DESCENDING).limit(20), uid)
        emitAll(combine(conversations, notifications) { _, _ -> Unit }.conflate())
    }

    suspend fun conversations(cursor: String?): ConversationDirectoryPage = mapConversationDirectory(call("listChatConversations", cursor))
    suspend fun bookings(cursor: String?): ConversationBookingPage = mapConversationBookings(call("listChatBookingOptions", cursor))

    private suspend fun call(name: String, cursor: String?): Map<*, *> {
        val uid = currentUid()
        val data = if (cursor == null) emptyMap() else mapOf("cursor" to cursor)
        val result = functions.getHttpsCallable(name).call(data).await().data as? Map<*, *>
            ?: throw ProviderConfigurationException("Liste des conversations indisponible.")
        check(currentUid() == uid) { "La session a changé." }
        return result
    }

    private fun changes(query: Query, uid: String): Flow<Unit> = callbackFlow {
        val listener = query.addSnapshotListener(MetadataChanges.INCLUDE) { value, error ->
            when {
                auth.currentUser?.uid != uid -> close(ProviderConfigurationException("Connexion requise."))
                error != null -> close(error)
                value != null && !value.metadata.isFromCache -> trySend(Unit)
            }
        }
        awaitClose { listener.remove() }
    }.conflate()

    private fun currentUid(): String = auth.currentUser?.uid ?: throw ProviderConfigurationException("Connexion requise.")
}
