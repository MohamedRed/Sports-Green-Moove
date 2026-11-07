package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.SupportSubmission
import be.sportgreenmoove.app.services.FileSupportSubmissionStore
import be.sportgreenmoove.app.services.SupportSubmissionStore
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files

class SupportSubmissionStateTest {
    private fun fixture(test: (java.io.File) -> Unit) {
        val dir = Files.createTempDirectory("support-state-").toFile()
        try { test(dir) } finally { dir.deleteRecursively() }
    }
    @Test fun lostAcknowledgementRestoresExactOperationAfterReopeningAndWaitsForExplicitRetry() = fixture { dir -> runBlocking {
        val calls = mutableListOf<SupportSubmission>()
        val first = SupportSubmissionState("parent", FileSupportSubmissionStore(dir)) { calls += it; error("Lost acknowledgement") }
        first.description("Demande de test"); first.emergency(true); first.submit()
        val operation = calls.single(); assertEquals(operation, first.pending); assertFalse(first.editable)
        first.description("Changed"); first.emergency(false); assertEquals(operation.description, first.description); assertTrue(first.emergency)
        first.close(); assertEquals("", first.description)
        val reopened = SupportSubmissionState("parent", FileSupportSubmissionStore(dir)) { calls += it; "report-1" }
        assertEquals(operation, reopened.pending); assertEquals(1, calls.size); assertTrue(reopened.emergency)
        reopened.submit(); assertEquals(listOf(operation, operation), calls); assertNull(reopened.pending)
        assertNull(FileSupportSubmissionStore(dir).read("parent")); assertTrue(reopened.editable); assertEquals("", reopened.description)
    } }
    @Test fun anotherAccountDoesNotReadOrSendTheOriginalPendingRequest() = fixture { dir -> runBlocking {
        val parent = SupportSubmissionState("parent", FileSupportSubmissionStore(dir)) { error("Account changed after send") }
        parent.description("Private parent request"); parent.submit(); val original = parent.pending
        val driver = SupportSubmissionState("driver", FileSupportSubmissionStore(dir)) { error("Must not send") }
        assertNull(driver.pending); assertEquals("", driver.description); driver.submit()
        assertEquals(original, FileSupportSubmissionStore(dir).read("parent"))
    } }
    @Test fun writeFailurePreventsAnyNetworkRequestAndDoesNotClaimSuccess() = runBlocking {
        var calls = 0
        val broken = object : SupportSubmissionStore {
            override fun read(uid: String): SupportSubmission? = null
            override fun begin(submission: SupportSubmission): SupportSubmission = error("Disk full")
            override fun acknowledge(uid: String, requestId: String) = error("Unexpected acknowledge")
        }
        val state = SupportSubmissionState("parent", broken) { calls++; "report" }
        state.description("Demande de test"); state.submit(); assertEquals(0, calls); assertFalse(state.message!!.startsWith("Signalement"))
    }
    @Test fun corruptStorageIsNotReplacedByAnEmptyOrNewRequest() = runBlocking {
        var calls = 0
        val broken = object : SupportSubmissionStore {
            override fun read(uid: String): SupportSubmission? = error("Corrupt")
            override fun begin(submission: SupportSubmission) = error("Must not write")
            override fun acknowledge(uid: String, requestId: String) = error("Must not clear")
        }
        val state = SupportSubmissionState("parent", broken) { calls++; "report" }
        assertFalse(state.ready); state.description("Changed"); state.submit(); state.restore(); assertEquals(0, calls); assertFalse(state.ready)
    }
    @Test fun closingDuringSendDiscardsLateUiResultButRetainsDurableOperation() = fixture { dir -> runBlocking {
        val response = CompletableDeferred<String>(); val entered = CompletableDeferred<Unit>()
        val state = SupportSubmissionState("parent", FileSupportSubmissionStore(dir)) { entered.complete(Unit); response.await() }
        state.description("Demande de test"); val task = async { state.submit() }; entered.await(); val operation = state.pending
        state.submit(); state.close(); response.complete("report"); task.await()
        assertNull(state.message); assertNull(state.pending); assertEquals(operation, FileSupportSubmissionStore(dir).read("parent"))
    } }
    @Test fun cancellationKeepsIdentityAndReleasesBusyState() = fixture { dir -> runBlocking {
        val entered = CompletableDeferred<Unit>()
        val state = SupportSubmissionState("parent", FileSupportSubmissionStore(dir)) { entered.complete(Unit); awaitCancellation() }
        state.description("Demande de test"); val task = launch { state.submit() }; entered.await(); val operation = state.pending
        task.cancelAndJoin(); assertFalse(state.busy); assertEquals(operation, FileSupportSubmissionStore(dir).read("parent"))
    } }
    @Test fun acknowledgementStorageFailureRetainsSameIdentityForRetry() = fixture { dir -> runBlocking {
        val real = FileSupportSubmissionStore(dir); var fail = true; val calls = mutableListOf<SupportSubmission>()
        val store = object : SupportSubmissionStore by real {
            override fun acknowledge(uid: String, requestId: String) { if (fail) error("Cannot clear"); real.acknowledge(uid, requestId) }
        }
        val state = SupportSubmissionState("parent", store) { calls += it; "report" }
        state.description("Demande de test"); state.submit(); assertNotNull(state.pending); fail = false; state.submit()
        assertEquals(2, calls.size); assertEquals(calls[0], calls[1]); assertNull(state.pending)
    } }
    @Test fun invalidOrOversizedInputNeverReachesStorageOrTransport() = fixture { dir -> runBlocking {
        var calls = 0; val state = SupportSubmissionState("parent", FileSupportSubmissionStore(dir)) { calls++; "report" }
        for (text in listOf("", "tiny", "x".repeat(2001))) { state.description(text); state.submit() }
        assertEquals(0, calls); assertNull(FileSupportSubmissionStore(dir).read("parent"))
    } }
}
