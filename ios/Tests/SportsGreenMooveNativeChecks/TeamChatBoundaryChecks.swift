import Foundation

@MainActor func checkTeamChatBoundaries() async {
    var count = 0
    for method in ["choices", "choices-more", "latest", "earlier", "send", "read"] {
        for failing in [false, true] {
            for revoke in ["logout", "same-uid", "other-uid", "role-roundtrip", "roles-revoked", "close", "background", "cancel"] {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-team-boundary-" + UUID().uuidString)
                let storage = TeamChatStorageProbe(directory: directory), scope = isolatedTeamScope(), gateway = TeamChatProbe()
                let choices = TeamChatDirectoryState(access: scope.access!, clubId: nil, gateway: gateway)
                let state = TeamChatState(access: scope.access!, target: isolatedTeamTarget, gateway: gateway, makeStorage: { storage })
                var expected = 1
                if method == "choices-more" {
                    await gateway.configure(choices: .init(items: [], nextCursor: "next")); await choices.refresh(); expected = 2
                } else if !["choices", "latest"].contains(method) {
                    await gateway.configure(page: isolatedTeamPage(cursor: method == "earlier" ? "next" : nil))
                    await state.refresh(); state.edit("Isolated draft"); expected = 2
                }
                let oldReads = storage.reads
                await gateway.configure(page: isolatedTeamPage([isolatedTeamMessage(1)]), suspend: true)
                let task = Task { await executeTeam(method, directory: choices, state: state) }
                await gateway.waitForCall(expected)
                check(scope.busy, "Team request did not retain unsettled account work")
                let before = await gateway.names
                await executeTeam(method, directory: choices, state: state)
                if revoke == "cancel" { task.cancel() }
                else if revoke == "close" { choices.close(); state.close() }
                else if revoke == "background" { choices.suspend(); state.suspend() }
                else if revoke == "role-roundtrip" {
                    replaceTeamAccount(scope, role: .driver); replaceTeamAccount(scope)
                } else if revoke == "roles-revoked" {
                    scope.replace(session: .init(uid: "parent", email: nil, displayName: nil, roles: [.child]), role: .child)
                } else {
                    scope.clear()
                    if revoke != "logout" { replaceTeamAccount(scope, uid: revoke == "same-uid" ? "parent" : "other") }
                }
                if !["close", "background", "cancel"].contains(revoke), let fresh = scope.access {
                    check(fresh.begin() == nil, "New team account work crossed an unsettled old request")
                }
                if revoke == "background" {
                    if method.hasPrefix("choices") { await choices.resume() } else { await state.resume() }
                }
                await executeTeam(method, directory: choices, state: state)
                check(scope.busy, "Team invalidation released its lease before callback settlement")
                await gateway.release(failing ? .storage : nil); await task.value
                let after = await gateway.names
                check(before == after, "Stale team request started duplicate or follow-up work: \(method)/\(revoke)/\(failing)")
                check(choices.items.isEmpty && choices.error == nil && !choices.loaded, "Stale directory restored private choices")
                check(state.messages.isEmpty && state.title == nil && !state.loaded && state.composer.body.isEmpty &&
                    state.composer.pending == nil && state.error == nil && state.readError == nil, "Stale team response restored data, draft or feedback")
                check(!scope.busy && !choices.busy && !state.busy, "Team request leaked unsettled work")
                if method == "latest" { check(storage.reads == oldReads, "Revoked team read restored a private draft") }
                try? FileManager.default.removeItem(at: directory); count += 1
            }
        }
    }
    print("TeamChatBoundaryChecks passed: \(count) delayed directory/latest/earlier/send/read success/error cases; account/role generations, close, background, cancellation, duplicate denial and actual callback drainage")
}

@MainActor private func replaceTeamAccount(_ scope: AccountWorkScope, uid: String = "parent", role: AppRole = .parent) {
    scope.replace(session: .init(uid: uid, email: nil, displayName: nil, roles: [.parent, .driver]), role: role)
}
@MainActor private func executeTeam(_ method: String, directory: TeamChatDirectoryState, state: TeamChatState) async {
    switch method {
    case "choices": await directory.refresh()
    case "choices-more": await directory.more()
    case "latest": await state.refresh()
    case "earlier": await state.earlier()
    case "send": await state.send()
    default: await state.markVisible([isolatedTeamMessage(2).id])
    }
}
