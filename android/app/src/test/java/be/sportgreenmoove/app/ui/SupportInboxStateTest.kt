package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.SupportGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class SupportInboxStateTest {
    private val reply = SupportReply("a".repeat(64), "Votre demande est traitée.", 1, 2000)
    private val report = SupportReport("report", "Trajet", "Ma demande de support.", false, SupportStatus.Closed, 1000, 2000, 1, reply)
    private class Gateway : SupportGateway {
        val owners = mutableListOf<String>(); val cursors = mutableListOf<String?>()
        var list: suspend (String?) -> SupportPage<SupportReport> = { error("Unexpected read") }
        var detail: suspend (String, String?) -> SupportDetail = { _, _ -> error("Unexpected detail") }
        override suspend fun supportReports(uid: String, cursor: String?): SupportPage<SupportReport> { owners += uid; cursors += cursor; return list(cursor) }
        override suspend fun supportReport(uid: String, reportId: String, cursor: String?): SupportDetail { owners += uid; cursors += cursor; return detail(reportId, cursor) }
    }
    @Test fun explicitPaginationAndDetailReturnUseTheSameOwner() = runBlocking {
        val gateway = Gateway(); gateway.list = { SupportPage(listOf(report.copy(id = if (it == null) "first" else "second")), if (it == null) "next" else null) }
        gateway.detail = { id, _ -> SupportDetail(report.copy(id = id), SupportPage(listOf(reply), null)) }
        val state = SupportInboxState("owner", gateway)
        state.more(); assertTrue(gateway.owners.isEmpty())
        state.refresh(); state.more(); assertEquals(2, state.reports.size); assertFalse(state.hasMore)
        state.open("first"); assertEquals("first", state.detail?.report?.id); assertTrue(state.reports.isEmpty())
        state.back(); assertNull(state.selectedId); assertEquals(1, state.reports.size)
        assertTrue(gateway.owners.all { it == "owner" })
    }
    @Test fun staleOrRepeatedPagesFailClosedUntilExplicitRefresh() = runBlocking {
        val gateway = Gateway(); gateway.list = { SupportPage(listOf(report), "next") }
        val state = SupportInboxState("owner", gateway); state.refresh(); state.more()
        assertFalse(state.loaded); assertNotNull(state.error); assertTrue(state.reports.isEmpty()); assertFalse(state.hasMore)
        val count = gateway.cursors.size; state.more(); assertEquals(count, gateway.cursors.size)
        gateway.list = { SupportPage(emptyList(), null) }; state.refresh(); assertTrue(state.loaded); assertNull(state.error)
    }
    @Test fun incompleteHistoryOrChangedReportNeedsRefresh() = runBlocking {
        val gateway = Gateway(); val state = SupportInboxState("owner", gateway)
        gateway.detail = { _, _ -> SupportDetail(report.copy(replyCount = 2, lastReply = reply.copy(sequence = 2)), SupportPage(listOf(reply.copy(sequence = 2)), "next")) }
        state.open(report.id); assertTrue(state.loaded)
        gateway.detail = { _, _ -> SupportDetail(report, SupportPage(listOf(reply), null)) }; state.more()
        assertNotNull(state.error); assertNull(state.detail)
        gateway.detail = { _, _ -> SupportDetail(report.copy(replyCount = 2, lastReply = reply.copy(sequence = 2)), SupportPage(listOf(reply.copy(sequence = 2)), null)) }
        state.refresh(); assertNotNull(state.error); assertNull(state.detail)
    }
    @Test fun closedAccountIgnoresPendingReplyAndNeverReadsAgain() = runBlocking {
        val gate = CompletableDeferred<SupportDetail>(); val gateway = Gateway(); gateway.detail = { _, _ -> gate.await() }
        val state = SupportInboxState("old", gateway); val job = launch(start = CoroutineStart.UNDISPATCHED) { state.open(report.id) }
        state.close(); gate.complete(SupportDetail(report, SupportPage(listOf(reply), null))); job.join()
        state.refresh(); assertEquals(1, gateway.owners.size); assertNull(state.detail); assertFalse(state.busy || state.loaded)
    }
    @Test fun navigatingAwayIgnoresAnOlderDetailResponse() = runBlocking {
        val gate = CompletableDeferred<SupportDetail>(); val gateway = Gateway(); gateway.detail = { _, _ -> gate.await() }
        gateway.list = { SupportPage(emptyList(), null) }; val state = SupportInboxState("owner", gateway)
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.open(report.id) }
        state.back(); gate.complete(SupportDetail(report, SupportPage(listOf(reply), null))); job.join()
        assertNull(state.detail); assertNull(state.selectedId); assertTrue(state.loaded)
    }
}
