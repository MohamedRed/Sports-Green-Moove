import Foundation

@MainActor func isolatedTeamScope(uid: String = "parent", role: AppRole = .parent, roles: [AppRole] = [.parent, .driver]) -> AccountWorkScope {
    let scope = AccountWorkScope(); scope.replace(session: .init(uid: uid, email: nil, displayName: nil, roles: roles), role: role); return scope
}

@MainActor func checkTeamChatState() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-team-state-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let storage = TeamChatStorageProbe(directory: directory), scope = isolatedTeamScope(), gateway = TeamChatProbe()
    let state = TeamChatState(access: scope.access!, target: isolatedTeamTarget, gateway: gateway, makeStorage: { storage })
    check(storage.reads == 0 && !state.loaded && !state.canSend, "Team draft was read before fresh authority")
    await state.refresh()
    check(state.loaded && state.composer.loaded && state.messages.count == 1, "Authorized team did not load")
    state.edit("  Synthetic message  ")
    let saved = try storage.read(uid: "parent", target: isolatedTeamTarget)
    check(saved?.body == state.composer.body, "Editable team draft was not persisted")
    state.close()
    let next = TeamChatState(access: scope.access!, target: isolatedTeamTarget, gateway: gateway, makeStorage: { storage })
    check(next.composer.body.isEmpty, "Reopened team displayed a cached draft without authority")
    await next.refresh()
    check(next.composer.body == "  Synthetic message  ", "Team draft was not restored after authorization")
    await gateway.configure(suspend: true)
    let send = Task { await next.send() }; await gateway.waitForCall(3)
    let pending = next.composer.pending
    check(pending?.requestId != nil && next.busy && scope.busy, "Pending team intent was not retained")
    next.edit("Changed body"); await next.send()
    await gateway.release(.storage); await send.value
    check(next.composer.pending == pending && next.composer.error != nil, "Uncertain team send discarded its identity")
    let first = await gateway.sends
    check(first.count == 1 && first[0].body == "Synthetic message", "Team dispatch changed or duplicated normalized body")
    await gateway.configure(commit: true); await next.send()
    let retries = await gateway.sends
    check(retries.count == 2 && retries[0].requestId == retries[1].requestId && retries[0].body == retries[1].body,
        "Explicit retry created a different team message intent")
    check(next.composer.pending == nil && next.composer.body.isEmpty, "Correlated team receipt did not clear the exact draft")
    await next.refresh()
    check(next.messages.contains { $0.senderId == "parent" && $0.body == "Synthetic message" }, "Confirmed team message did not reload")
    next.edit("Receipt lost")
    await gateway.configure(suspend: true, commit: true)
    let lost = Task { await next.send() }; await gateway.waitForCall(6)
    await gateway.release(.storage); await lost.value
    let before = await gateway.sends
    check(next.composer.pending != nil, "Lost receipt was marked confirmed before a read")
    await next.refresh()
    let after = await gateway.sends
    check(next.composer.pending == nil && next.composer.body.isEmpty && before == after,
        "Fresh owned message did not reconcile without resending")
    next.edit("Definite rejection")
    await gateway.configure(suspend: true)
    let rejected = Task { await next.send() }; await gateway.waitForCall(8)
    await gateway.release(.sendRejected); await rejected.value
    check(next.composer.pending == nil && next.composer.body == "Definite rejection", "First definite rejection lost or locked editable text")
    await gateway.configure(suspend: true)
    let uncertain = Task { await next.send() }; await gateway.waitForCall(9)
    await gateway.release(.storage); await uncertain.value
    let locked = next.composer.pending
    await gateway.configure(suspend: true)
    let rejectedRetry = Task { await next.send() }; await gateway.waitForCall(10)
    await gateway.release(.sendRejected); await rejectedRetry.value
    check(next.composer.pending == locked, "Rejected retry incorrectly ruled out the earlier uncertain commit")
    next.suspend()
    check(next.messages.isEmpty && next.composer.body.isEmpty && next.title == nil, "Background team state retained private content")
    await checkTeamReadAndStorage()
    print("TeamChatStateChecks passed: authorized draft restore, stable-ID explicit retry, lost-receipt read reconciliation, first/retried rejection, exact body and private background state; controlled gateways only")
}

@MainActor private func checkTeamReadAndStorage() async {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-team-read-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let storage = TeamChatStorageProbe(directory: directory), gateway = TeamChatProbe(), scope = isolatedTeamScope()
    let state = TeamChatState(access: scope.access!, target: isolatedTeamTarget, gateway: gateway, makeStorage: { storage })
    let incoming = isolatedTeamMessage(2), unseen = isolatedTeamMessage(1), mine = isolatedTeamMessage(3, sender: "parent")
    await gateway.configure(page: isolatedTeamPage([mine, incoming, unseen])); await state.refresh()
    await state.markVisible([mine.id, "foreign"])
    let initialReads = await gateway.reads
    check(initialReads.isEmpty, "Own, foreign or unshown team message was marked read")
    await gateway.configure(suspend: true)
    let read = Task { await state.markVisible([incoming.id]) }; await gateway.waitForCall(2)
    await gateway.release(.storage); await read.value
    check(state.readError != nil && state.messages.contains { $0.id == incoming.id && $0.needsRead }, "Unknown read was marked synchronized")
    await state.markVisible([incoming.id])
    let implicitReads = await gateway.reads
    check(implicitReads.count == 1, "Unconfirmed team read retried automatically")
    await state.markVisible([unseen.id])
    check(state.readError != nil, "Another successful read hid a still-unconfirmed message")
    await state.markVisible([incoming.id], retry: true)
    check(state.readError == nil && state.messages.filter { $0.senderId != "parent" }.allSatisfy { !$0.needsRead }, "Explicit visible read retry failed")
    state.edit("Storage failure"); storage.fail(true)
    let before = await gateway.sends
    await state.send()
    let afterStorageFailure = await gateway.sends
    check(afterStorageFailure == before, "Team send started without a persisted intent")
    check(state.composer.body == "Storage failure" && state.composer.error != nil, "Storage failure lost the prior draft")
    storage.fail(false)
    await gateway.configure(suspend: true, commit: true)
    let sent = Task { await state.send() }; await gateway.waitForCall(5)
    storage.fail(true); await gateway.release(); await sent.value
    check(state.composer.pending != nil && state.composer.error != nil, "Failed local acknowledgement lost the pending identity")
    storage.fail(false); await state.refresh()
    check(state.composer.pending == nil && state.composer.body.isEmpty, "Confirmed send did not recover failed draft removal")
    await gateway.configure(page: isolatedTeamPage([isolatedTeamMessage(2_000)])); await state.refresh()
    await gateway.configure(suspend: true)
    let denied = Task { await state.markVisible([isolatedTeamMessage(2_000).id]) }; await gateway.waitForCall(8)
    await gateway.release(.accessRejected); await denied.value
    check(state.error != nil && state.messages.isEmpty && state.composer.body.isEmpty, "Rejected read retained a stale private conversation")
    for role in [AppRole.child, .admin] {
        let other = isolatedTeamScope(role: role, roles: [role]), probe = TeamChatProbe()
        let denied = TeamChatState(access: other.access!, target: isolatedTeamTarget, gateway: probe, makeStorage: { storage })
        await denied.refresh(); denied.edit("Blocked"); await denied.send(); await denied.markVisible([incoming.id])
        let deniedCalls = await probe.names
        check(deniedCalls.isEmpty, "Non-adult selected role used team chat")
    }
    print("Team read/storage checks passed: visible incoming IDs only, no implicit read retry, explicit recovery, unknown-write preservation, denied authority scrubbing and child/admin rejection")
}
