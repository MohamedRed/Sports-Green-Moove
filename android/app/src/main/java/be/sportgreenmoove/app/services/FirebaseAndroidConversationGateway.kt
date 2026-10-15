package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.data.ConversationPage
import be.sportgreenmoove.app.data.ConversationRef
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import com.google.firebase.firestore.Source
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidConversationGateway(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : ConversationGateway {
    private data class Access(val uid: String, val names: Map<String, String>)
    override fun observeInboxChanges(): Flow<Unit> = flow {
        val uid = currentUid()
        val messages = snapshots(firestore.collection("messages").whereArrayContains("participantUserIds", uid)
            .orderBy("createdAt", Query.Direction.DESCENDING).limit(50), uid)
        val notifications = snapshots(firestore.collection("notifications").whereEqualTo("userId", uid)
            .orderBy("createdAt", Query.Direction.DESCENDING).limit(20), uid)
        emitAll(combine(messages, notifications) { _, _ -> Unit }.conflate())
    }

    override fun observeConversation(ref: ConversationRef): Flow<ConversationPage> = flow {
        val access = authorize(ref)
        emitAll(snapshots(messageQuery(ref, access.uid).limit(51), access.uid).map { page(it.documents, access, ref) })
    }

    override suspend fun loadEarlier(ref: ConversationRef, cursorId: String): ConversationPage {
        val access = authorize(ref)
        val uid = access.uid
        val cursor = firestore.collection("messages").document(cursorId).get(Source.SERVER).await()
        validateMessage(cursor, uid, ref)
        val documents = messageQuery(ref, uid).startAfter(cursor).limit(51).get(Source.SERVER).await().documents
        checkIdentity(uid)
        return page(documents, access, ref)
    }

    override suspend fun sendMessage(ref: ConversationRef, body: String, requestId: String): String {
        val uid = currentUid()
        val sourceKey = if (ref.kind == ConversationKind.Booking) "bookingId" else "rideSessionId"
        val result = try {
            functions.getHttpsCallable("sendChatMessage").call(mapOf(
                sourceKey to ref.sourceId, "body" to body, "clientMessageId" to requestId,
            )).await().data as? Map<*, *> ?: throw ProviderConfigurationException("Envoi non confirmé.")
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            val code = (error as? FirebaseFunctionsException)?.code
            throw MessageSendException(code in setOf(FirebaseFunctionsException.Code.INVALID_ARGUMENT,
                FirebaseFunctionsException.Code.PERMISSION_DENIED, FirebaseFunctionsException.Code.UNAUTHENTICATED,
                FirebaseFunctionsException.Code.NOT_FOUND, FirebaseFunctionsException.Code.FAILED_PRECONDITION,
                FirebaseFunctionsException.Code.ALREADY_EXISTS, FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED), error)
        }
        checkIdentity(uid)
        return result["messageId"] as? String ?: throw ProviderConfigurationException("Envoi non confirmé.")
    }

    override suspend fun markRead(ref: ConversationRef, messageIds: List<String>) {
        if (messageIds.isEmpty()) return
        val uid = currentUid()
        require(messageIds.size <= 50 && messageIds.distinct().size == messageIds.size)
        functions.getHttpsCallable("markChatMessagesRead").call(sourceData(ref) + ("messageIds" to messageIds)).await()
        checkIdentity(uid)
    }

    private suspend fun authorize(ref: ConversationRef): Access {
        val uid = currentUid()
        val result = functions.getHttpsCallable("getChatConversation").call(sourceData(ref)).await().data as? Map<*, *>
        val conversation = result?.get("conversation") as? Map<*, *>
        checkIdentity(uid)
        if (conversation?.get("currentUserId") != uid || conversation["sourceType"] != ref.kind.sourceType ||
            conversation["sourceId"] != ref.sourceId) throw ProviderConfigurationException("Conversation inaccessible.")
        val names = (conversation["participants"] as? List<*>).orEmpty().mapNotNull { item ->
            val participant = item as? Map<*, *> ?: return@mapNotNull null
            val id = participant["userId"] as? String ?: return@mapNotNull null
            val name = participant["displayName"] as? String ?: return@mapNotNull null
            id to name
        }.toMap()
        return Access(uid, names)
    }

    private fun messageQuery(ref: ConversationRef, uid: String): Query = firestore.collection("messages")
        .whereArrayContains("participantUserIds", uid).whereEqualTo("sourceType", ref.kind.sourceType)
        .whereEqualTo("sourceId", ref.sourceId).orderBy("createdAt", Query.Direction.DESCENDING)
        .orderBy(FieldPath.documentId(), Query.Direction.DESCENDING)

    private fun snapshots(query: Query, uid: String): Flow<QuerySnapshot> = callbackFlow {
        val listener = query.addSnapshotListener(MetadataChanges.INCLUDE) { snapshot, error ->
            when {
                auth.currentUser?.uid != uid -> close(ProviderConfigurationException("Connexion requise."))
                error != null -> close(error)
                snapshot != null && !snapshot.metadata.isFromCache -> trySend(snapshot)
            }
        }
        awaitClose { listener.remove() }
    }.conflate()

    private fun page(documents: List<DocumentSnapshot>, access: Access, ref: ConversationRef): ConversationPage {
        val uid = access.uid
        val selected = documents.take(50)
        return ConversationPage(selected.map { document ->
            validateMessage(document, uid, ref)
            val createdAt = document.getTimestamp("createdAt") ?: throw ProviderConfigurationException("Date du message indisponible.")
            val sender = document.getString("senderUserId") ?: throw ProviderConfigurationException("Auteur du message indisponible.")
            ConversationMessage(id = document.id,
                body = document.getString("body") ?: throw ProviderConfigurationException("Contenu du message indisponible."),
                mine = sender == uid, createdAtSeconds = createdAt.seconds, createdAtNanos = createdAt.nanoseconds,
                needsRead = sender != uid && !(document.get("readByUserIds") as? List<*>).orEmpty().contains(uid),
                requestId = document.getString("clientMessageId"), authorName = access.names[sender])
        }, if (documents.size > 50) selected.last().id else null,
            access.names.filterKeys { it != uid }.values.distinct())
    }

    private fun validateMessage(document: DocumentSnapshot, uid: String, ref: ConversationRef) {
        if (!document.exists() || document.getString("sourceType") != ref.kind.sourceType ||
            document.getString("sourceId") != ref.sourceId || !(document.get("participantUserIds") as? List<*>).orEmpty().contains(uid)) {
            throw ProviderConfigurationException("Message inaccessible dans cette conversation.")
        }
    }

    private fun sourceData(ref: ConversationRef): Map<String, Any> = mapOf("sourceType" to ref.kind.sourceType, "sourceId" to ref.sourceId)
    private fun currentUid(): String = auth.currentUser?.uid ?: throw ProviderConfigurationException("Connexion requise.")
    private fun checkIdentity(uid: String) { check(currentUid() == uid) { "La session a changé." } }
}
