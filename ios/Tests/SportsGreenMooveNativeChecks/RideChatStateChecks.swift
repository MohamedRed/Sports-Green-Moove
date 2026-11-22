import Foundation

@MainActor func rideChatState(_ scope: AccountWorkScope, _ probe: RideChatProbe, directory: URL) -> RideChatThreadState {
    .init(uid: rideChatOwner, reference: rideChatReference, access: scope.access!, gateway: probe,
        makeStorage: { RideChatDraftStore(directory: directory) })
}
@MainActor func checkRideChatState() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-ride-state-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let scope = rideChatScope(), probe = RideChatProbe(), state = rideChatState(scope, probe, directory: root)
    let run = Task { await state.run() }
    await rideChatEventually({ state.loaded }, "Thread never loaded")
    check(state.participants.keys.contains(rideChatDriver) && state.canCompose && !state.busy, "Fresh authority did not enable composer")
    state.edit("Message de trajet isolé")
    probe.suspended = true
    let read = Task { await state.markVisible([rideChatRow(51).id, rideChatRow(1).id]) }
    await rideChatEventually({ probe.reply != nil }, "Read never started")
    state.edit("Message de trajet isolé complet")
    check(state.composer.body == "Message de trajet isolé complet" && !state.canSend, "Read interrupted typing or permitted concurrent send")
    probe.release(ProviderConfigurationError(message: "isolated transport failure")); await read.value
    check(state.readError != nil && probe.reads == [[rideChatRow(51).id]], "Read acknowledged invisible or absent history")
    await state.markVisible([rideChatRow(51).id]); check(probe.reads.count == 1, "Unknown read was implicitly retried")
    await state.markVisible([rideChatRow(51).id], retry: true)
    check(probe.reads.count == 2 && state.readError == nil && state.messages.first?.needsRead == false, "Explicit read retry failed")
    probe.suspended = true
    let earlier = Task { await state.earlier() }
    await rideChatEventually({ probe.reply != nil }, "Earlier page never started")
    state.edit("Message de trajet isolé complet après historique")
    probe.release(); await earlier.value
    check(state.messages.count == 51 && !state.hasEarlier && state.composer.body.hasSuffix("après historique"), "Earlier page truncated history or draft")
    probe.suspended = true
    let send = Task { await state.send() }
    await rideChatEventually({ probe.reply != nil }, "Send never started")
    let pending = state.composer.pending!
    let saved = try RideChatDraftStore(directory: root).read(uid: rideChatOwner, reference: rideChatReference)
    check(saved == pending, "Send dispatched before stable intent persisted")
    await state.send(); state.edit("replacement denied")
    check(probe.sends.count == 1 && state.composer.body == pending.body, "Concurrent send or edit replaced pending intent")
    probe.release(ProviderConfigurationError(message: "lost receipt")); await send.value
    check(state.composer.pending == pending && state.composer.error != nil, "Lost send receipt erased intent")
    await state.send()
    check(probe.sends.count == 2 && probe.sends[0] == probe.sends[1] && state.composer.body.isEmpty, "Explicit retry changed UUID/body or failed acknowledgement")
    state.edit("retained private draft"); state.suspend(); await run.value
    check(state.messages.isEmpty && state.composer.body.isEmpty && !scope.busy && !probe.watch.isCurrent, "Background retained private UI or listener/lease")
    let freshProbe = RideChatProbe(), fresh = rideChatState(scope, freshProbe, directory: root)
    freshProbe.suspended = true
    let freshRun = Task { await fresh.run() }
    await rideChatEventually({ freshProbe.reply != nil }, "Fresh authority gate never started")
    check(!fresh.loaded && fresh.composer.body.isEmpty && !fresh.canCompose, "Private draft restored before authority")
    freshProbe.release(); await rideChatEventually({ fresh.loaded }, "Fresh view did not load")
    check(fresh.composer.body == "retained private draft", "Private draft lost across screen recreation")
    freshProbe.watch.revoke(); await freshRun.value
    check(fresh.messages.isEmpty && fresh.composer.body.isEmpty && fresh.error != nil && !scope.busy, "Revoked current source retained private thread")
    print("RideChatStateChecks passed: fresh-grant-only drafts, edit during reads, full earlier history, visible-only read/explicit retry, persisted stable send, uncertain retry, reopen and revocation cleanup")
}
