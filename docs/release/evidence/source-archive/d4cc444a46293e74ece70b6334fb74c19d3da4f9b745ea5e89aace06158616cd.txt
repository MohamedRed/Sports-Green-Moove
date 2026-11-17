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
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.launch

internal class MessagesInboxState(uid: String, private val firebase: FirebaseGateway, private val gateway: ConversationGateway) {
    private var closed = false
    val conversations = ConversationDirectoryState(gateway)
    val notificationReads = NotificationReadState(uid, firebase)
    val reviews = PendingReviewsState(uid, firebase)
    val displayedInbox get() = inbox.copy(notifications = inbox.notifications.map(notificationReads::display), reviews = reviews.items)
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
    var reviewFailure by mutableStateOf<ReviewSubmissionFailure?>(null)
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
        if (closed || submittingReviewId != null) return
        submittingReviewId = id
        reviewFailure = null
        notice = null
        try {
            firebase.submitRating(rideSessionId, ratedUserId, score)
            currentCoroutineContext().ensureActive()
            if (closed) return
            reviews.submitted(id)
            notice = "Avis envoyé."
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) {
            if (!closed) reviewFailure = ReviewSubmissionFailure(id, UserFacingErrorPolicy.messageFor(failure))
        }
        finally { submittingReviewId = null }
    }

    private suspend fun refreshMetadata() {
        try { updateInbox(firebase.getInbox()); error = null; loading = false }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { error = UserFacingErrorPolicy.messageFor(failure); loading = false }
    }

    private fun updateInbox(value: InboxSummary) {
        notificationReads.reconcile(value.notifications)
        reviews.replace(value.reviews, value.reviewsNextCursor)
        inbox = value
    }

    fun close() {
        closed = true; reviews.close(); notificationReads.clear()
        reviewFailure = null; submittingReviewId = null; notice = null
    }
}

internal data class ReviewSubmissionFailure(val reviewId: String, val message: String)
