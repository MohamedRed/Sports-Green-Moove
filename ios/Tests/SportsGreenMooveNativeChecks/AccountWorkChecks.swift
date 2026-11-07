import Foundation

@MainActor
func checkAccountWorkScope() async {
    let scope = AccountWorkScope()
    check(scope.access == nil && !scope.busy, "Empty scope fabricated an account")
    scope.replace(session: AuthSession(uid: "isolated-a", email: nil, displayName: nil, roles: [.driver]), role: .driver)
    let old = scope.access!
    let first = old.begin()!
    check(old.owns(first) && scope.busy, "Current work did not own its scope")
    scope.replace(session: AuthSession(uid: "isolated-b", email: nil, displayName: nil, roles: [.driver]), role: .driver)
    let current = scope.access!
    check(!old.isCurrent && !old.owns(first) && old.begin() == nil, "Old account access survived replacement")
    check(current.begin() == nil && current.waitingForEarlierWork, "New identity work overlapped unsettled older work")
    old.finish(first)
    let second = current.begin()!
    old.finish(first)
    check(current.owns(second) && scope.busy, "Old cleanup released a newer account's work")
    scope.clear()
    check(!current.isCurrent && scope.busy && scope.access == nil, "Revocation erased unsettled work")
    scope.replace(session: AuthSession(uid: "isolated-a", email: nil, displayName: nil, roles: [.driver]), role: .driver)
    let returned = scope.access!
    check(returned.context.id != old.context.id && returned.begin() == nil, "Same-UID return revived an old generation")
    current.finish(second)
    let active = returned.begin()!
    let parallel = returned.begin()!
    returned.finish(active)
    check(returned.owns(parallel), "One current completion released unrelated current work")
    returned.finish(parallel)
    let cancelled = Task { returned.begin() == nil }
    cancelled.cancel()
    let cancelledDenied = await cancelled.value
    check(cancelledDenied && !scope.busy, "Cancelled intent registered work")
    scope.replace(session: AuthSession(uid: "isolated-a", email: nil, displayName: nil, roles: [.parent]), role: .driver)
    check(scope.access == nil && !scope.busy, "Scope accepted a role not granted to the account")
    print("Account work checks passed: explicit identity, generation isolation, old-work drain, parallel ownership and cancelled intent; local state only")
}
