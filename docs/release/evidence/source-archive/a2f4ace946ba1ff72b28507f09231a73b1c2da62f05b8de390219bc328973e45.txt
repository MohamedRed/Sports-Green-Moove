import Foundation

private actor SupportFixture: SupportGateway {
    let reply = SupportReply(id: String(repeating: "a", count: 64), text: "Votre demande est traitée.", sequence: 1, sentAtMillis: 2000)
    var calls = 0
    var repeatedPage = false
    var report: SupportReport {
        .init(id: "ticket", reason: "Trajet", description: "Une demande de support.", emergency: false, status: .closed,
              createdAtMillis: 1000, updatedAtMillis: 2000, replyCount: 1, lastReply: reply)
    }
    func repeatPage() { repeatedPage = true }
    func supportReports(uid: String, cursor: String?) async throws -> SupportPage<SupportReport> {
        guard uid == "parent" else { throw CancellationError() }; calls += 1
        return .init(items: [report], nextCursor: repeatedPage ? "next" : nil)
    }
    func supportReport(uid: String, reportId: String, cursor: String?) async throws -> SupportDetail {
        guard uid == "parent", reportId == "ticket" else { throw CancellationError() }; calls += 1
        return .init(report: report, replies: .init(items: [reply], nextCursor: nil))
    }
}

@MainActor func checkSupportState() async {
    let gateway = SupportFixture(); let state = SupportInboxState(uid: "parent", gateway: gateway)
    await state.more(); let initialCalls = await gateway.calls; check(initialCalls == 0, "Support must not invent a next page")
    await state.refresh(); check(state.loaded && state.reports.count == 1 && state.error == nil, "Support inbox did not load")
    await state.open("ticket"); check(state.detail?.report.status == .closed && state.detail?.replies.items.count == 1, "Support written response missing")
    await state.back(); check(state.detail == nil && state.selectedId == nil && state.reports.count == 1, "Support back navigation retained detail")
    await gateway.repeatPage(); await state.refresh(); await state.more()
    check(state.error != nil && state.reports.isEmpty && !state.loaded && !state.hasMore, "Repeated support page must fail closed")
    state.close(); let before = await gateway.calls; await state.refresh(); await state.open("ticket")
    let finalCalls = await gateway.calls
    check(finalCalls == before && state.detail == nil && state.reports.isEmpty, "Closed support account made another read")
    print("SupportStateChecks passed")
}
