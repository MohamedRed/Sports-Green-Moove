import Foundation
import Observation

@MainActor @Observable final class TeamChatState {
    private(set) var title: String?
    private(set) var messages: [TeamChatMessage] = []
    private(set) var loaded = false
    private(set) var error: String?
    private(set) var readError: String?
    let composer: TeamChatComposer
    let target: TeamChatTarget
    let uid: String
    private let access: AccountAccess
    private let gateway: any TeamChatGateway
    private var timeline = TeamChatTimeline()
    private var version: String?
    private var acknowledged: Set<String> = []
    private var attemptedReads: Set<String> = []
    private var unconfirmedReads: Set<String> = []
    private var generation = UUID()
    private var active = true
    private var closed = false
    private var inFlight = 0
    var live: Bool { !closed && active && TeamChatPolicy.permits(access) && TeamChatWire.validTarget(target) }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }
    var hasEarlier: Bool { live && loaded && error == nil && timeline.olderCursor != nil }
    var canCompose: Bool { live && loaded && title != nil && error == nil && composer.loaded }
    var canSend: Bool { canCompose && !busy && TeamChatWire.validBody(TeamChatText.normalized(composer.body)) }

    init(access: AccountAccess, target: TeamChatTarget, gateway: any TeamChatGateway,
        makeStorage: @escaping @Sendable () throws -> any TeamChatDraftStorage) {
        self.access = access; self.target = target; self.gateway = gateway; uid = access.context.uid
        composer = .init(uid: access.context.uid, target: target, makeStorage: makeStorage)
    }
    private func clear() {
        generation = UUID(); timeline = TeamChatTimeline(); version = nil; messages = []; title = nil
        loaded = false; error = nil; readError = nil; acknowledged = []; attemptedReads = []; unconfirmedReads = []; composer.clear()
    }
    func suspend() { active = false; clear() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; active = true; await refresh() }
    func edit(_ body: String) { if canCompose && composer.pending == nil { composer.edit(body) } }
    func retryDraft() { if live && loaded && !busy && error == nil { composer.load() } }
    private func retain(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }; return false
    }
    private func fail() { clear(); error = "Impossible de vérifier la conversation. Actualisez." }
    private func publish() {
        timeline.markRead(acknowledged); messages = timeline.messages
        unconfirmedReads.formIntersection(messages.filter { $0.needsRead }.map(\.id))
        readError = unconfirmedReads.isEmpty ? nil : "Lecture non synchronisée. Réessayez."
        composer.reconcile(messages)
    }
    func refresh() async { await load(earlier: false) }
    func earlier() async { if hasEarlier { await load(earlier: true) } }
    private func load(earlier: Bool) async {
        guard live, !busy, let work = access.begin() else { return }
        defer { access.finish(work) }
        let cursor = earlier ? timeline.olderCursor : nil
        guard !earlier || cursor != nil else { return }
        let ticket = generation, previous = version; inFlight += 1
        defer { inFlight -= 1 }
        do {
            let page = try await gateway.teamChatMessages(uid: uid, target: target, cursor: cursor)
            guard retain(ticket, work) else { return }
            try TeamChatWire.require(!page.items.contains { $0.senderId == uid && $0.needsRead })
            if let cursor {
                try TeamChatWire.require(page.accessVersion == previous)
                try timeline.earlier(page, requested: cursor)
            } else {
                if page.accessVersion != previous {
                    timeline = TeamChatTimeline(); acknowledged = []; attemptedReads = []; unconfirmedReads = []; readError = nil
                }
                try timeline.latest(page)
            }
            version = page.accessVersion; title = page.title; loaded = true; error = nil
            composer.load(); publish()
        } catch { if retain(ticket, work) { fail() } }
    }
    func send() async {
        guard canSend, let work = access.begin() else { return }
        defer { access.finish(work) }
        guard let prepared = composer.prepare(), let requestId = prepared.draft.requestId else { return }
        let ticket = generation; inFlight += 1
        defer { inFlight -= 1 }
        do {
            let id = try await gateway.sendTeamChat(uid: uid, target: target,
                body: TeamChatText.normalized(prepared.draft.body), requestId: requestId)
            guard retain(ticket, work) else { return }
            try TeamChatWire.require(try id == TeamChatIdentity.operation(uid: uid, requestId: requestId))
            composer.acknowledge(prepared.draft)
        } catch {
            guard retain(ticket, work) else { return }
            composer.failed(prepared.draft, rejected: (error as? TeamChatError) == .sendRejected, retrying: prepared.retrying)
        }
    }
    func markVisible(_ visible: Set<String>, retry: Bool = false) async {
        guard live, loaded, !busy, error == nil, let version else { return }
        let rows = messages.filter { $0.needsRead && $0.senderId != uid && visible.contains($0.id) }
        if retry { attemptedReads.subtract(rows.map(\.id)) }
        let ids = Array(rows.filter { !attemptedReads.contains($0.id) }.prefix(50).map(\.id))
        guard !ids.isEmpty, let work = access.begin() else { return }
        let ticket = generation; attemptedReads.formUnion(ids); inFlight += 1
        defer { inFlight -= 1; access.finish(work) }
        do {
            try await gateway.readTeamChat(uid: uid, target: target, accessVersion: version, ids: ids)
            guard retain(ticket, work) else { return }
            acknowledged.formUnion(ids); unconfirmedReads.subtract(ids); publish()
        } catch {
            guard retain(ticket, work) else { return }
            if (error as? TeamChatError) == .accessRejected { fail() }
            else { unconfirmedReads.formUnion(ids); readError = "Lecture non synchronisée. Réessayez." }
        }
    }
}
