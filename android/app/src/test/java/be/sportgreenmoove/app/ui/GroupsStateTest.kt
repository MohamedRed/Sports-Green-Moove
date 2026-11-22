package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ClubSummary
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class GroupsStateTest {
    @Test fun initialLoadingIsNotAnEmptyResult() = runBlocking {
        val state = GroupsState({ emptyList() }, { error("Unexpected write") })
        assertTrue(state.loading)
        state.reload()
        assertFalse(state.loading)
        assertNull(state.error)
        assertTrue(state.clubs.isEmpty())
    }

    @Test fun refreshReplacesPendingWithTheServerDecision() = runBlocking {
        var result = listOf(club("requested"))
        val loaded = mutableListOf<List<ClubSummary>>()
        val state = GroupsState({ result }, { error("Unexpected write") }, loaded::add)
        state.reload()
        assertTrue(state.clubs.single().hasPendingRequest)
        result = listOf(club("active"))
        state.reload()
        assertTrue(state.clubs.single().isMember)
        result = listOf(club("rejected"))
        state.reload()
        assertFalse(state.clubs.single().isMember)
        assertFalse(state.clubs.single().hasPendingRequest)
        assertEquals(3, loaded.size)
    }

    @Test fun anOlderRefreshCannotReplaceTheLatestMembership() = runBlocking {
        val old = CompletableDeferred<List<ClubSummary>>()
        var calls = 0
        val state = GroupsState({ if (calls++ == 0) old.await() else listOf(club("active")) }, { "id" })
        val pending = launch(start = CoroutineStart.UNDISPATCHED) { state.reload() }
        state.reload()
        old.complete(listOf(club("requested")))
        pending.join()
        assertTrue(state.clubs.single().isMember)
        assertFalse(state.loading)
    }

    @Test fun leavingAnAccountInvalidatesItsLateResponseAndCallback() = runBlocking {
        val old = CompletableDeferred<List<ClubSummary>>()
        var published = false
        val state = GroupsState({ old.await() }, { "id" }, { published = true })
        val pending = launch(start = CoroutineStart.UNDISPATCHED) { state.reload() }
        state.close()
        old.complete(listOf(club("active")))
        pending.join()
        state.reload()
        assertTrue(state.clubs.isEmpty())
        assertFalse(published)
        assertNull(state.error)
    }

    @Test fun concurrentRequestsAndReloadDuringSubmissionCannotDuplicateTheWrite() = runBlocking {
        val ack = CompletableDeferred<String>()
        var writes = 0
        var reads = 0
        val state = GroupsState({ reads++; listOf(club(if (writes > 0) "requested" else "rejected")) }, { writes++; ack.await() })
        state.reload()
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.join("club") }
        state.join("club")
        state.reload()
        assertEquals(1, writes)
        assertEquals(1, reads)
        ack.complete("membership")
        request.join()
        assertEquals(2, reads)
        assertTrue(state.clubs.single().hasPendingRequest)
        assertNotNull(state.notice)
        state.join("club")
        state.join("unknown")
        assertEquals(1, writes)
    }

    @Test fun uncertainWriteRequiresAnExplicitRefreshBeforeAnotherAction() = runBlocking {
        var writes = 0
        var reads = 0
        val state = GroupsState({ reads++; listOf(club(if (writes > 0) "requested" else "rejected")) }, {
            writes++; error("Connection ended before acknowledgement")
        })
        state.reload()
        state.join("club")
        assertNotNull(state.error)
        assertTrue(state.clubs.isEmpty())
        state.join("club")
        assertEquals(1, writes)
        assertEquals(1, reads)
        state.reload()
        assertNull(state.error)
        assertTrue(state.clubs.single().hasPendingRequest)
        assertEquals(1, writes)
    }

    @Test fun acknowledgedWriteAndFailedReadRetainTheAcknowledgementWithoutOldActions() = runBlocking {
        var reads = 0
        val state = GroupsState({ if (reads++ == 0) listOf(club("rejected")) else error("Read failed") }, { "membership" })
        state.reload()
        state.join("club")
        assertEquals("Demande prise en compte.", state.notice)
        assertNotNull(state.error)
        assertTrue(state.clubs.isEmpty())
        assertFalse(state.loading)
    }

    @Test fun closedRequestCannotReloadOrPublishInAnotherAccount() = runBlocking {
        val ack = CompletableDeferred<String>()
        var reads = 0
        val state = GroupsState({ reads++; listOf(club("rejected")) }, { ack.await() })
        state.reload()
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.join("club") }
        state.close()
        ack.complete("membership")
        request.join()
        assertEquals(1, reads)
        assertNull(state.notice)
        assertTrue(state.clubs.isEmpty())
    }

    @Test fun cancellationDoesNotPublishOrBecomeAnError() = runBlocking {
        val response = CompletableDeferred<List<ClubSummary>>()
        val state = GroupsState({ response.await() }, { "id" })
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.reload() }
        request.cancelAndJoin()
        assertTrue(request.isCancelled)
        assertTrue("An interrupted read is not a confirmed empty result", state.loading)
        assertNull(state.error)
        assertTrue(state.clubs.isEmpty())
    }

    private fun club(status: String) = ClubSummary("club", "Club QA", "Football", 2,
        if (status == "active") "MEMBRE" else null, "CQ", emptyList(), status, status == "active")
}
