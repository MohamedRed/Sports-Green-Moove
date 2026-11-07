package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ConversationDirectoryPage
import be.sportgreenmoove.app.services.ConversationGateway
import be.sportgreenmoove.app.services.UnconfiguredConversationGateway
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ConversationDirectoryStateTest {
    @Test fun supersededInitialRequestDoesNotPresentAnEmptyInboxBeforeTheReplacementLoads() = runBlocking {
        var ready = false
        val gateway = object : ConversationGateway by UnconfiguredConversationGateway() {
            override suspend fun loadConversations(cursor: String?): ConversationDirectoryPage {
                if (!ready) awaitCancellation()
                return ConversationDirectoryPage(emptyList(), null, null, null)
            }
        }
        val state = ConversationDirectoryState(gateway)
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.refreshLatest() }
        assertTrue(state.loading)
        first.cancelAndJoin()
        assertTrue(state.loading)
        assertNull(state.error)
        ready = true
        state.refreshLatest()
        assertFalse(state.loading)
        assertTrue(state.items.isEmpty())
        assertNull(state.error)
    }

    @Test fun failedInitialRequestEndsLoadingWithAnExplicitError() = runBlocking {
        val state = ConversationDirectoryState(UnconfiguredConversationGateway())
        state.refreshLatest()
        assertFalse(state.loading)
        assertTrue(state.error != null)
    }
}
