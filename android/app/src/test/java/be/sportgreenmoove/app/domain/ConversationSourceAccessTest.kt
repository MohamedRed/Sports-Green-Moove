package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ConversationKind
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ConversationSourceAccessTest {
    @Test fun parentTakesPrecedenceOverTheRetainedRequester() {
        val source = mapOf("parentUserId" to "new", "requesterUserId" to "old", "driverUserId" to "driver")
        assertFalse(ConversationSourceAccess.permits(ConversationKind.Booking, "old", source))
        assertTrue(ConversationSourceAccess.permits(ConversationKind.Booking, "new", source))
        assertTrue(ConversationSourceAccess.permits(ConversationKind.Booking, "driver", source))
        for (parent in listOf(emptyMap(), mapOf("parentUserId" to null))) {
            assertTrue(ConversationSourceAccess.permits(ConversationKind.Booking, "old", parent + ("requesterUserId" to "old")))
        }
    }

    @Test fun cancellationDoesNotRemoveParticipantsButDeletionDoes() {
        assertTrue(ConversationSourceAccess.permits(ConversationKind.Booking, "parent",
            mapOf("parentUserId" to "parent", "status" to "cancelled")))
        assertFalse(ConversationSourceAccess.permits(ConversationKind.Booking, "parent", null))
        assertFalse(ConversationSourceAccess.permits(ConversationKind.Booking, "", emptyMap()))
    }

    @Test fun currentRideDriverParticipantAndChildAreRequired() {
        val kind = ConversationKind.RideSession
        for (field in listOf("driverUserId", "participantUserIds", "childUserIds")) {
            val value = if (field == "driverUserId") "old" else listOf("old")
            assertTrue(ConversationSourceAccess.permits(kind, "old", mapOf(field to value)))
            assertFalse(ConversationSourceAccess.permits(kind, "old", mapOf(field to emptyList<String>())))
        }
        for (invalid in listOf(null, "old", mapOf("old" to true))) for (field in listOf("participantUserIds", "childUserIds")) {
            assertFalse(ConversationSourceAccess.permits(kind, "driver", mapOf("driverUserId" to "driver", field to invalid)))
        }
    }

    @Test fun waitsForSourceThenRevokesWithoutAnotherMessageAndDisposesTheMessageListener() = runTest {
        val access = MutableSharedFlow<Boolean>()
        var opened = 0; var disposed = 0; var failure: Throwable? = null
        val seen = mutableListOf<String>()
        val job = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            try {
                ConversationSourceAccess.guard(access) {
                    flow { opened++; try { emit("private"); awaitCancellation() } finally { disposed++ } }
                }.collect { seen += it }
            } catch (error: Exception) { failure = error }
        }
        assertEquals(0, opened)
        access.emit(true); testScheduler.runCurrent()
        assertEquals(listOf("private"), seen)
        access.emit(true); testScheduler.runCurrent(); assertEquals(1, opened)
        access.emit(false); testScheduler.runCurrent()
        assertTrue(failure is ConversationAccessRevokedException)
        assertEquals(1, disposed); assertTrue(job.isCompleted)
    }

    @Test fun initialRevocationCannotOpenTheMessageListener() = runTest {
        var opened = false
        val failure = runCatching {
            ConversationSourceAccess.guard(flow { emit(false) }) { flow { opened = true; emit("private") } }.collect {}
        }.exceptionOrNull()
        assertTrue(failure is ConversationAccessRevokedException); assertFalse(opened)
    }

    @Test fun cancellingTheCollectorDisposesBothOwnedFlows() = runTest {
        var sourceClosed = false; var messagesClosed = false
        val job = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            ConversationSourceAccess.guard(flow {
                try { emit(true); awaitCancellation() } finally { sourceClosed = true }
            }) { flow<String> { try { awaitCancellation() } finally { messagesClosed = true } } }.collect {}
        }
        testScheduler.runCurrent(); job.cancelAndJoin()
        assertTrue(sourceClosed); assertTrue(messagesClosed)
    }
}
