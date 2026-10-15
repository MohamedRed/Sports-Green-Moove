package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.InboxSummary
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.ConversationGateway
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.launch

internal class MessagesInboxState(private val firebase: FirebaseGateway, private val gateway: ConversationGateway) {
    val conversations = ConversationDirectoryState(gateway)
    var inbox by mutableStateOf(InboxSummary())
        private set
    var loading by mutableStateOf(true)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var notice by mutableStateOf<String?>(null)
        private set
    var submittingReviewId by mutableStateOf<String?>(null)
        private set

    suspend fun observe() {
        try {
            gateway.observeInboxChanges().onStart { emit(Unit) }.collectLatest {
                coroutineScope {
                    launch { refreshMetadata() }
                    launch { conversations.refreshLatest() }
                }
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) {
            conversations.fail(failure)
            error = UserFacingErrorPolicy.messageFor(failure)
            loading = false
        }
    }

    suspend fun submitReview(id: String, rideSessionId: String, ratedUserId: String, score: Int) {
        if (submittingReviewId != null) return
        submittingReviewId = id
        error = null
        notice = null
        try {
            firebase.submitRating(rideSessionId, ratedUserId, score)
            inbox = firebase.getInbox()
            notice = "Avis envoyé."
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { error = UserFacingErrorPolicy.messageFor(failure) }
        finally { submittingReviewId = null }
    }

    private suspend fun refreshMetadata() {
        try { inbox = firebase.getInbox(); error = null; loading = false }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { error = UserFacingErrorPolicy.messageFor(failure); loading = false }
    }
}
