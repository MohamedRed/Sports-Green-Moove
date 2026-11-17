package be.sportgreenmoove.app.services

import com.google.android.gms.tasks.TaskCompletionSource
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class QueuedTeamPushTokenSourceTest {
    @Test fun cancelledTokenAwaitDoesNotAllowDeletionToOvertakeItsActualSdkCompletion() = runTest {
        val token = TaskCompletionSource<String>(); val deletion = TaskCompletionSource<Void>(); var deleteCalls = 0
        val source = QueuedTeamPushTokenSource({}, { token.task }, { deleteCalls++; deletion.task })
        val acquire = async { source.token() }; runCurrent(); acquire.cancelAndJoin()
        val remove = async { source.deleteToken() }; runCurrent(); assertEquals(0, deleteCalls)
        token.setResult("synthetic-token"); runCurrent(); assertEquals(1, deleteCalls)
        deletion.setResult(null); remove.await()
    }
    @Test fun cancelledDeletionAwaitCannotDeleteATokenFetchedForTheNextOwner() = runTest {
        val token = TaskCompletionSource<String>(); val deletion = TaskCompletionSource<Void>(); var tokenCalls = 0
        val source = QueuedTeamPushTokenSource({}, { tokenCalls++; token.task }, { deletion.task })
        val remove = async { source.deleteToken() }; runCurrent(); remove.cancelAndJoin()
        val acquire = async { source.token() }; runCurrent(); assertEquals(0, tokenCalls)
        deletion.setResult(null); runCurrent(); assertEquals(1, tokenCalls)
        token.setResult("synthetic-next-owner-token"); assertEquals("synthetic-next-owner-token", acquire.await())
    }
    @Test fun aTerminalSdkFailureIsReportedAndOnlyALaterExplicitOperationCanProceed() = runTest {
        val old = TaskCompletionSource<String>(); val fresh = TaskCompletionSource<String>(); var calls = 0
        val source = QueuedTeamPushTokenSource({}, { if (calls++ == 0) old.task else fresh.task }, { TaskCompletionSource<Void>().task })
        val first = async { runCatching { source.token() } }; runCurrent(); old.setException(IllegalStateException("Synthetic SDK failure"))
        assertTrue(first.await().isFailure); assertEquals(1, calls)
        val next = async { source.token() }; runCurrent(); assertEquals(2, calls)
        fresh.setResult("synthetic-next-token"); assertEquals("synthetic-next-token", next.await())
    }
}
