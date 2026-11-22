package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.domain.ConversationSourceAccess
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

internal fun observeConversationSource(
    firestore: FirebaseFirestore, auth: FirebaseAuth, ref: ConversationRef, uid: String,
): Flow<Boolean> = callbackFlow {
    val collection = if (ref.kind == ConversationKind.Booking) "bookings" else "rideSessions"
    val identity = FirebaseAuth.AuthStateListener {
        if (it.currentUser?.uid != uid) close(ProviderConfigurationException("Connexion requise."))
    }
    auth.addAuthStateListener(identity)
    try {
      val source = firestore.collection(collection).document(ref.sourceId)
        .addSnapshotListener(MetadataChanges.INCLUDE) { snapshot, error ->
            when {
                auth.currentUser?.uid != uid -> close(ProviderConfigurationException("Connexion requise."))
                error != null -> close(error)
                snapshot != null && !snapshot.metadata.isFromCache -> {
                    val allowed = !snapshot.metadata.hasPendingWrites() &&
                        ConversationSourceAccess.permits(ref.kind, uid, snapshot.data)
                    trySend(allowed)
                }
            }
        }
      awaitClose { source.remove() }
    } finally { auth.removeAuthStateListener(identity) }
}
