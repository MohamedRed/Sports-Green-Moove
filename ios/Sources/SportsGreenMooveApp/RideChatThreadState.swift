import Foundation
import Observation

@MainActor @Observable final class RideChatThreadState {
    let uid: RideChatID
    let reference: RideChatReference
    let composer: RideChatComposer
    private(set) var messages: [RideChatMessage] = []
    private(set) var participants: [RideChatID: String?] = [:]
    private(set) var loaded = false
    private(set) var error: String?
    private(set) var readError: String?
    private(set) var earlierError: String?
    private(set) var hasEarlier = false
    private let access: AccountAccess
    private let gateway: any RideChatGateway
    private var timeline = RideChatTimeline()
    private var watch: (any RideChatWatch)?
    private var generation = UUID()
    private var active = false
    private var closed = false
    private var running = false
    private var waiting: [CheckedContinuation<Void, Never>] = []
    private var inFlight = 0
    private var attempted = Set<RideChatID>()
    private var unconfirmed = Set<RideChatID>()
    var live: Bool { !closed && active && access.isCurrent && uid.value.utf8.elementsEqual(access.context.uid.utf8) }
    var busy: Bool { inFlight > 0 || (running && !loaded) || access.waitingForEarlierWork }
    var canCompose: Bool { live && loaded && error == nil && watch?.isCurrent == true && composer.loaded }
    var canSend: Bool { canCompose && !busy && RideChatText.valid(composer.body) }
    init(uid: RideChatID, reference: RideChatReference, access: AccountAccess, gateway: any RideChatGateway,
        makeStorage: @escaping @Sendable () throws -> any RideChatDraftStorage) {
        self.uid = uid; self.reference = reference; self.access = access; self.gateway = gateway
        composer = .init(uid: uid, reference: reference, makeStorage: makeStorage)
    }
    private func clear() {
        timeline = .init(); messages = []; participants = [:]; loaded = false; hasEarlier = false
        error = nil; readError = nil; earlierError = nil; attempted = []; unconfirmed = []; composer.clear()
    }
    func suspend() { active = false; generation = UUID(); watch?.close(); watch = nil; clear() }
    func close() { closed = true; suspend() }
    private func owns(_ ticket: UUID, _ work: AccountWork) -> Bool {
        live && generation == ticket && access.owns(work)
    }
    private func fail() { generation = UUID(); watch?.close(); watch = nil; clear(); error = "Conversation indisponible. Actualisez." }
    func run() async {
        guard !closed else { return }; active = true
        let ticket = generation
        if running { await withCheckedContinuation { waiting.append($0) } }
        guard live, ticket == generation, !running, let work = access.begin() else { return }
        running = true
        var opened: (any RideChatWatch)?
        defer {
            opened?.close()
            if generation == ticket { watch = nil; if !live || Task.isCancelled { clear() } }
            access.finish(work); running = false
            let waiters = waiting; waiting = []; waiters.forEach { $0.resume() }
        }
        do {
            let stream = try await gateway.openRideChat(uid: uid, reference: reference); opened = stream
            guard owns(ticket, work) else { return }
            try RideChatWire.require(stream.access.uid == uid && stream.access.reference == reference &&
                stream.access.participants.keys.contains(uid) && (1...100).contains(stream.access.participants.count))
            _ = try RideChatWire.text(stream.access.title)
            watch = stream
            for try await page in stream.updates {
                guard owns(ticket, work) else { break }
                try RideChatWire.require(stream.isCurrent && page.uid == uid && page.reference == reference)
                try timeline.latest(page); participants = stream.access.participants; loaded = true; error = nil
                composer.load(); try publish()
            }
            if owns(ticket, work) { fail() }
        } catch { if owns(ticket, work) { fail() } }
    }
    func edit(_ body: String) { if canCompose && composer.pending == nil { composer.edit(body) } }
    func retryDraft() { if live && loaded && error == nil && !busy && watch?.isCurrent == true { composer.load() } }
    private func publish() throws {
        messages = timeline.messages; hasEarlier = timeline.older != nil
        unconfirmed.formIntersection(messages.filter(\.needsRead).map(\.id))
        readError = unconfirmed.isEmpty ? nil : "Lecture non synchronisée. Réessayez."
        try composer.reconcile(messages)
    }
    func earlier() async {
        guard live, loaded, !busy, error == nil, watch?.isCurrent == true, let cursor = timeline.older, let work = access.begin() else { return }
        let ticket = generation; inFlight += 1; earlierError = nil
        defer { inFlight -= 1; access.finish(work) }
        do {
            let page = try await gateway.earlierRideChat(uid: uid, reference: reference, cursor: cursor)
            guard owns(ticket, work) else { return }
            try RideChatWire.require(watch?.isCurrent == true && page.uid == uid && page.reference == reference)
            try timeline.earlier(page, after: cursor); try publish()
        } catch {
            if owns(ticket, work) {
                if error is RideChatError { fail() } else { earlierError = "Impossible de charger les messages précédents. Réessayez." }
            }
        }
    }
    func send() async {
        guard canSend, let work = access.begin() else { return }
        defer { access.finish(work) }
        guard let prepared = composer.prepare(), let request = prepared.draft.requestId else { return }
        let ticket = generation; inFlight += 1
        defer { inFlight -= 1 }
        do {
            let result = try await gateway.sendRideChat(uid: uid, reference: reference,
                body: RideChatText.normalized(prepared.draft.body), requestId: request)
            guard owns(ticket, work) else { return }
            try RideChatWire.require(watch?.isCurrent == true && result.uid == uid && result.reference == reference &&
                result.requestId == request && result.messageId.value == TeamChatIdentity.operation(uid: uid.value, requestId: request))
            composer.acknowledge(prepared.draft)
        } catch {
            guard owns(ticket, work) else { return }
            composer.failed(prepared.draft, rejected: (error as? RideChatError) == .sendRejected, retrying: prepared.retrying)
            if watch?.isCurrent != true { fail() }
        }
    }
    func markVisible(_ visible: Set<RideChatID>, retry: Bool = false) async {
        guard live, loaded, error == nil, !busy, watch?.isCurrent == true else { return }
        let ids = Array(messages.filter { $0.needsRead && $0.sender != uid && visible.contains($0.id) &&
            (!attempted.contains($0.id) || (retry && unconfirmed.contains($0.id))) }.prefix(50).map(\.id))
        guard !ids.isEmpty, let work = access.begin() else { return }
        let ticket = generation; inFlight += 1; attempted.formUnion(ids)
        defer { inFlight -= 1; access.finish(work) }
        do {
            let receipt = try await gateway.readRideChat(uid: uid, reference: reference, ids: ids)
            guard owns(ticket, work) else { return }
            try RideChatWire.require(watch?.isCurrent == true && receipt.uid == uid && receipt.reference == reference && receipt.ids == ids)
            timeline.markRead(Set(ids)); unconfirmed.subtract(ids); try publish()
        } catch {
            guard owns(ticket, work) else { return }
            if error is RideChatError || watch?.isCurrent != true { fail() }
            else {
                unconfirmed.formUnion(messages.filter { $0.needsRead && ids.contains($0.id) }.map(\.id))
                readError = unconfirmed.isEmpty ? nil : "Lecture non synchronisée. Réessayez."
            }
        }
    }
}
