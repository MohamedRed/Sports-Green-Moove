import Foundation

@MainActor func checkTeamChatEditing() async throws {
    let baseline = ProcessInfo.processInfo.environment["SGM_TEAM_INPUT_BASELINE"] == "true"
    let prefix = "Message de test iso", complete = prefix + "l\u{00e9}"
    var count = 0
    for operation in ["refresh", "earlier", "read"] {
        for boundary in ["success", "failure", "background", "account"] {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-team-edit-" + UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: directory) }
            let storage = TeamChatStorageProbe(directory: directory), scope = isolatedTeamScope(), gateway = TeamChatProbe()
            let state = TeamChatState(access: scope.access!, target: isolatedTeamTarget, gateway: gateway, makeStorage: { storage })
            state.edit("Before authorization")
            check(state.composer.body.isEmpty, "Unauthorized composer accepted input")
            await gateway.configure(page: isolatedTeamPage(cursor: "qa-more")); await state.refresh()
            state.edit(prefix)
            await gateway.configure(page: operation == "earlier" ? isolatedTeamPage([isolatedTeamMessage(1)]) : nil, suspend: true)
            let read = Task { @MainActor in
                if operation == "refresh" { await state.refresh() }
                else if operation == "earlier" { await state.earlier() }
                else { await state.markVisible([isolatedTeamMessage(2).id]) }
            }
            await gateway.waitForCall(2)
            check(state.busy && !state.canSend, "Send became available during an owned read")
            state.edit(complete)
            let expected = baseline ? prefix : complete
            check(state.composer.body == expected, "A read discarded the last draft characters")
            let saved = try storage.read(uid: "parent", target: isolatedTeamTarget)
            check(saved?.body == expected && saved?.requestId == nil, "Editing did not persist the exact unsent body")
            await state.send(); let sends = await gateway.sends
            check(sends.isEmpty, "Typing during a read dispatched a message")
            if boundary == "background" { state.suspend() }
            if boundary == "account" {
                scope.replace(session: .init(uid: "other", email: nil, displayName: nil, roles: [.parent]), role: .parent)
                state.edit("Other account input")
            }
            await gateway.release(boundary == "failure" ? .storage : nil); await read.value
            let persisted = try storage.read(uid: "parent", target: isolatedTeamTarget)
            check(persisted?.body == expected && persisted?.requestId == nil, "Read completion changed a private draft")
            if boundary == "success" || (boundary == "failure" && operation == "read") {
                check(state.composer.body == expected && state.canCompose, "Read completion failed to retain editable text")
            } else {
                check(state.composer.body.isEmpty && !state.canSend, "A late read restored private text after access closed")
            }
            check(!scope.busy && !state.busy, "Editing test left an undrained owned callback")
            state.close(); count += 1
        }
    }
    print("TeamChatEditingChecks: \(count) \(baseline ? "baseline draft truncation reproductions (not accepted)" : "exact-body read/input boundaries passed"); no phone or provider")
}
