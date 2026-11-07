import Foundation
import Observation

@Observable @MainActor final class SupportInboxState {
    private(set) var reports: [SupportReport] = []
    private(set) var detail: SupportDetail?
    private(set) var selectedId: String?
    private(set) var busy = false
    private(set) var loaded = false
    private(set) var error: String?
    private var cursor: String?
    private var generation = 0
    private var closed = false
    private let uid: String
    private let gateway: any SupportGateway
    var hasMore: Bool { cursor != nil && error == nil }

    init(uid: String, gateway: any SupportGateway) { self.uid = uid; self.gateway = gateway }
    func clear() { generation += 1; reports = []; detail = nil; busy = false; loaded = false; error = nil; cursor = nil }
    func close() { clear(); closed = true }
    func refresh() async { await load(reset: true) }
    func more() async { if hasMore && !busy { await load(reset: false) } }
    func open(_ id: String) async { clear(); selectedId = id; await refresh() }
    func back() async { clear(); selectedId = nil; await refresh() }

    private func load(reset: Bool) async {
        guard !closed, !busy else { return }
        let requested = reset ? nil : cursor
        guard reset || requested != nil else { return }
        generation += 1; let ticket = generation; let id = selectedId
        busy = true; error = nil
        if reset { reports = []; detail = nil; cursor = nil; loaded = false }
        defer { if !closed && generation == ticket { busy = false } }
        do {
            if let id {
                let next = try await gateway.supportReport(uid: uid, reportId: id, cursor: requested)
                try Task.checkCancellation(); guard !closed, generation == ticket else { return }
                try SupportWire.validate(next.report); try SupportWire.validate(next.replies)
                try SupportWire.require(next.report.id == id && (detail == nil || detail?.report == next.report))
                let prior = detail?.replies.items ?? []
                try validate(next.replies, requested: requested, prior: prior.map(\.id))
                let rows = prior + next.replies.items
                for reply in rows { try SupportWire.validate(reply); try SupportWire.require(reply.sequence <= next.report.replyCount) }
                try SupportWire.require(zip(rows, rows.dropFirst()).allSatisfy { $0.sequence == $1.sequence + 1 })
                try SupportWire.require(rows.isEmpty ? next.report.replyCount == 0 : rows.first == next.report.lastReply)
                try SupportWire.require(next.replies.nextCursor != nil || (rows.last?.sequence ?? 1) == 1)
                detail = .init(report: next.report, replies: .init(items: rows, nextCursor: next.replies.nextCursor)); cursor = next.replies.nextCursor
            } else {
                let page = try await gateway.supportReports(uid: uid, cursor: requested)
                try Task.checkCancellation(); guard !closed, generation == ticket else { return }
                try SupportWire.validate(page); for report in page.items { try SupportWire.validate(report) }
                try validate(page, requested: requested, prior: reports.map(\.id))
                reports += page.items; cursor = page.nextCursor
            }
            loaded = true
        } catch is CancellationError { }
        catch {
            guard !closed, generation == ticket else { return }
            reports = []; detail = nil; cursor = nil; loaded = false
            self.error = "Impossible de consulter vos demandes. Actualisez pour réessayer."
        }
    }
    private func validate<T>(_ page: SupportPage<T>, requested: String?, prior: [String]) throws where T: Identifiable, T.ID == String {
        try SupportWire.require(!page.items.contains { prior.contains($0.id) })
        try SupportWire.require(page.nextCursor == nil || page.nextCursor != requested)
    }
}
