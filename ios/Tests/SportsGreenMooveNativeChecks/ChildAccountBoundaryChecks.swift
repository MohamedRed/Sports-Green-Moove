import Foundation

@MainActor func checkChildAccountBoundaries() async throws {
    var count = 0
    for method in ["code", "approve", "current", "create", "revoke"] { for failing in [false, true] {
        for mode in ["background", "close", "logout", "same-uid", "other-uid", "role-roundtrip", "cancel"] {
            let child = method == "code", uid = child ? "child-login" : "isolated-parent", roles: [AppRole] = child ? [.child] : [.parent, .driver]
            let (scope, access) = emergencyAccess(uid: uid, roles: roles), target = try isolatedChildTarget(), probe = ChildAccountProbe()
            let code = ChildAccountState(access: access, target: child ? nil : target, gateway: probe, now: { isolatedChildNow })
            let invitation = ChildInvitationState(access: access, target: target, gateway: probe, now: { isolatedChildNow })
            if method == "approve" { code.edit(isolatedChildCode) }
            if method == "create" || method == "revoke" { await invitation.refresh() }
            if method == "revoke" { await invitation.create() }
            let before = await probe.calls.count; await probe.holdNext()
            let task = Task {
                switch method {
                case "code": await code.create()
                case "approve": await code.approve()
                case "current": await invitation.refresh()
                case "create": await invitation.create()
                default: await invitation.revoke()
                }
            }
            await probe.waitForCall()
            if mode == "background" {
                if method == "code" || method == "approve" { code.suspend(); code.resume() }
                else { invitation.suspend(); await invitation.resume() }
            }
            else if mode == "close" { code.close(); invitation.close() }
            else if mode == "cancel" { task.cancel() }
            else {
                scope.clear()
                if mode != "logout" {
                    if mode == "role-roundtrip" { scope.replace(session: AuthSession(uid: uid, email: nil, displayName: nil, roles: [.driver]), role: .driver) }
                    scope.replace(session: AuthSession(uid: mode == "other-uid" ? "other" : uid, email: nil, displayName: nil, roles: roles), role: roles[0])
                }
            }
            check(scope.busy && (code.busy || invitation.busy), "Invalidation released unsettled child account work")
            if method == "code" { await code.create() } else if method == "approve" { await code.approve() } else { await invitation.refresh() }
            await probe.release(failing: failing); await task.value
            let after = await probe.calls.count
            check(after == before + 1 && !scope.busy && !code.busy && !invitation.busy, "Stale work dispatched duplicates or retained/released wrong lease")
            check(code.code == nil && code.input.isEmpty && !code.approved && code.error == nil && invitation.current == nil && invitation.sharingURL() == nil && invitation.error == nil,
                "Late child-account callback restored private data, feedback or approval")
            count += 1
        }
    }}
    print("ChildAccountBoundaryChecks passed: \(count) delayed success/error callbacks across all five methods and account/role generations, background, closure and cancellation; no stale restoration or duplicate calls")
}
