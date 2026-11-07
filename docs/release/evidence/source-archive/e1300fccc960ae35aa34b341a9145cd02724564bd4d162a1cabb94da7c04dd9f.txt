package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.domain.ConversationAccessRevokedException
import be.sportgreenmoove.app.services.ConversationGateway
import be.sportgreenmoove.app.services.UnconfiguredConversationGateway
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ConversationStateTest {
    private val ref = ConversationRef(ConversationKind.Booking, "qa-booking")
    private val page = ConversationPage(listOf(ConversationMessage("new", "private", false, 20, needsRead = true)),
        "new", listOf("QA parent"))
    private class Gateway : ConversationGateway by UnconfiguredConversationGateway() {
        val pages = Channel<ConversationPage>(Channel.UNLIMITED)
        val earlier = CompletableDeferred<ConversationPage>()
        val read = CompletableDeferred<Unit>()
        override fun observeConversation(ref: ConversationRef) = pages.receiveAsFlow()
        override suspend fun loadEarlier(ref: ConversationRef, cursorId: String) = withContext(NonCancellable) { earlier.await() }
        override suspend fun markRead(ref: ConversationRef, messageIds: List<String>) = withContext(NonCancellable) { read.await() }
    }

    @Test fun revocationClearsAllPrivateContentAndPagination() = runTest {
        val gateway = Gateway(); val state = ConversationState(ref, gateway)
        val job = launch(UnconfinedTestDispatcher(testScheduler)) { state.observe() }
        gateway.pages.send(page); testScheduler.runCurrent(); assertEquals(page.messages, state.messages)
        gateway.pages.close(ConversationAccessRevokedException()); job.join()
        assertTrue(state.messages.isEmpty()); assertTrue(state.participantNames.isEmpty())
        assertFalse(state.hasEarlier); assertFalse(state.loadingEarlier); assertNotNull(state.error)
    }

    @Test fun lateEarlierSuccessOrFailureCannotRestoreContentAfterRevocation() = runTest {
        for (fail in listOf(false, true)) {
            val gateway = Gateway(); val state = ConversationState(ref, gateway)
            val observer = launch(UnconfinedTestDispatcher(testScheduler)) { state.observe() }
            gateway.pages.send(page); testScheduler.runCurrent()
            val earlier = launch(UnconfinedTestDispatcher(testScheduler)) { state.loadEarlier() }
            gateway.pages.close(ConversationAccessRevokedException()); observer.join()
            if (fail) gateway.earlier.completeExceptionally(IllegalStateException("private error"))
            else gateway.earlier.complete(page.copy(messages = listOf(ConversationMessage("old", "older private", false, 10))))
            earlier.join(); assertTrue(state.messages.isEmpty()); assertNull(state.earlierError)
            assertFalse(state.hasEarlier); assertFalse(state.loadingEarlier)
        }
    }

    @Test fun lateReadSuccessOrFailureCannotRestoreFeedbackAfterRevocation() = runTest {
        for (fail in listOf(false, true)) {
            val gateway = Gateway(); val state = ConversationState(ref, gateway)
            val observer = launch(UnconfinedTestDispatcher(testScheduler)) { state.observe() }
            gateway.pages.send(page); testScheduler.runCurrent()
            val read = launch(UnconfinedTestDispatcher(testScheduler)) { state.markVisibleRead(listOf("new")) }
            gateway.pages.close(ConversationAccessRevokedException()); observer.join()
            if (fail) gateway.read.completeExceptionally(IllegalStateException("private error")) else gateway.read.complete(Unit)
            read.join(); assertTrue(state.messages.isEmpty()); assertNull(state.readError)
        }
    }

    @Test fun lifecycleCancellationScrubsContentBeforeAReplacementObservation() = runTest {
        val gateway = Gateway(); val state = ConversationState(ref, gateway)
        val observer = launch(UnconfinedTestDispatcher(testScheduler)) { state.observe() }
        gateway.pages.send(page); testScheduler.runCurrent(); observer.cancelAndJoin()
        assertTrue(state.messages.isEmpty()); assertTrue(state.participantNames.isEmpty()); assertFalse(state.hasEarlier)
    }
}
