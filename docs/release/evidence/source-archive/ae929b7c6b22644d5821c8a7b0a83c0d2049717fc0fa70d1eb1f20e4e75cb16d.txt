import Foundation

@MainActor func checkGuardianContactBoundaries() async {
    var completed = 0
    for action in ["refresh", "more"] {
        for failing in [false, true] {
            for revoke in ["same-uid", "other-uid", "role-roundtrip", "close", "background", "cancel"] {
                let (account, access) = emergencyAccess()
                let row = isolatedGuardianContact(1)
                let gateway = GuardianContactProbe(pages: ["first": .init(items: [row], nextCursor: "next"),
                    "next": .init(items: [isolatedGuardianContact(2)], nextCursor: nil)])
                let state = GuardianContactState(access: access, gateway: gateway)
                if action == "more" { await state.refresh() }
                let held = await gateway.holdNext()
                let task = Task { if action == "refresh" { await state.refresh() } else { await state.more() } }
                await gateway.waitForCall(held)
                check(account.busy && state.busy && state.select(row) == nil && state.personal() == nil,
                    "Busy verified-child selection accepted an action during an unsettled read")
                if revoke == "close" { state.close() }
                else if revoke == "background" { state.suspend() }
                else if revoke == "cancel" { task.cancel() }
                else {
                    let roles: [AppRole] = [.parent, .driver]
                    if revoke == "role-roundtrip" {
                        account.replace(session: AuthSession(uid: "isolated-parent", email: nil, displayName: nil, roles: roles), role: .driver)
                    }
                    account.replace(session: AuthSession(uid: revoke == "other-uid" ? "other-parent" : "isolated-parent",
                        email: nil, displayName: nil, roles: roles), role: .parent)
                    check(account.access?.begin() == nil, "Changed account admitted another operation before guardian read settlement")
                }
                await gateway.release(held, failing: failing); await task.value
                let calls = await gateway.count()
                check(calls == held && state.items.isEmpty && state.error == nil && !state.loaded && !state.hasMore && !state.busy && !account.busy,
                    "Late guardian page restored a private choice, cursor, feedback or admission lease")
                completed += 1
            }
        }
    }
    print("GuardianContactBoundaryChecks passed: \(completed) delayed refresh/more success/error boundaries; busy selection, same-UID/account/role changes, close, background and cancellation")
}
