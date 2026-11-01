package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MessagesNotificationPollingTest {
    private val notice = InboxNotificationSummary("teamChat_one", "Nouveau message d’équipe", "Avis QA", "1 novembre", true, "NM")
    private fun review(id: String) = InboxReviewPrompt(id, id, "driver", "Avis", "Votre avis ?", "AV")
    private fun conversations() = object : ConversationGateway by UnconfiguredConversationGateway() {
        override fun observeInboxChanges() = flow<Unit> { awaitCancellation() }
        override suspend fun loadConversations(cursor: String?) = ConversationDirectoryPage(emptyList(),null,null,null)
    }
    @Test fun notificationPollingDoesNotResetLoadedReviewPagesOrConversationHistory() = runTest {
        var metadataCalls = 0; var notificationCalls = 0
        val firebase = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun getInbox(): InboxSummary { metadataCalls++; return InboxSummary(reviews=listOf(review("first")),reviewsNextCursor="one") }
            override suspend fun loadPendingReviews(cursor: String) = PendingReviewPage("parent",listOf(review("second")),null)
            override suspend fun loadNotificationInbox(uid: String): List<InboxNotificationSummary> { notificationCalls++; return listOf(notice) }
        }
        val state = MessagesInboxState("parent",firebase,conversations()); val job=launch { state.observe() };runCurrent()
        state.reviews.loadMore();assertEquals(listOf("first","second"),state.reviews.items.map { it.id })
        val initial=metadataCalls;advanceTimeBy(12_000);runCurrent()
        assertEquals(initial,metadataCalls);assertEquals(4,notificationCalls)
        assertEquals(listOf("first","second"),state.reviews.items.map { it.id });assertNull(state.reviews.nextCursor)
        assertEquals(listOf(notice),state.displayedInbox.notifications)
        job.cancelAndJoin();assertTrue(state.displayedInbox.notifications.isEmpty())
    }
    @Test fun aSeparateReviewFailureDoesNotDisableThePrimaryNotificationRead() = runTest {
        var calls=0
        val firebase=object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun getInbox(): InboxSummary = error("Synthetic review service error")
            override suspend fun loadNotificationInbox(uid: String): List<InboxNotificationSummary> { calls++; return listOf(notice) }
        }
        val state=MessagesInboxState("parent",firebase,conversations());val job=launch { state.observe() };runCurrent()
        assertNotNull(state.error);assertNull(state.notificationInbox.error);assertEquals(listOf(notice),state.displayedInbox.notifications)
        advanceTimeBy(4_000);runCurrent();assertEquals(2,calls);job.cancelAndJoin()
    }
    @Test fun endingTheObservationClearsReadConfirmationsBeforeTheNextOwner() = runTest {
        val firebase=object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun getInbox()=InboxSummary()
            override suspend fun loadNotificationInbox(uid: String)=listOf(notice)
            override suspend fun markNotificationRead(uid: String,notificationId: String) {}
        }
        val state=MessagesInboxState("parent",firebase,conversations());var job=launch { state.observe() };runCurrent()
        state.notificationReads.markRead(notice);assertFalse(state.displayedInbox.notifications.single().unread)
        job.cancelAndJoin();assertTrue(state.displayedInbox.notifications.isEmpty())
        job=launch { state.observe() };runCurrent();assertTrue(state.displayedInbox.notifications.single().unread)
        job.cancelAndJoin();state.close();assertTrue(state.displayedInbox.notifications.isEmpty())
    }
}
