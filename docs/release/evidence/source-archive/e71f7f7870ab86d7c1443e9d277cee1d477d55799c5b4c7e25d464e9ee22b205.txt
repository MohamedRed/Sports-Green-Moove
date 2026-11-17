import Foundation

@MainActor func checkProfileCityState() async {
    let scope = isolatedTeamScope(), probe = ProfileCityProbe(), access = scope.access!
    let state = ProfileCityState(access: access, gateway: probe)
    state.input = "Wavre"; await state.save()
    let noCalls = await probe.calls; check(noCalls.isEmpty, "City saved before a server revision was read")
    await state.refresh(); check(state.view?.revision == 0 && state.view?.city == nil && !state.canSave, "Absent city was not read")
    state.input = "a\nb"; await state.save(); let invalidWrites = await probe.changes
    check(invalidWrites.isEmpty, "Unsafe input reached the city gateway")
    state.input = " Lie\u{0300}ge "; await state.save()
    check(state.view?.city == "Liège" && state.view?.revision == 1 && state.notice != nil && !state.canSave, "City receipt did not bind normalized input and revision")
    await state.save(); let first = await probe.changes
    check(first.count == 1, "Unchanged city sent a redundant write")
    await state.save(removing: true)
    check(state.view?.city == nil && state.view?.revision == 2 && !state.canRemove, "City deletion lost the authoritative tombstone revision")
    state.input = "Namur"; await probe.configure(failure: true); await state.save()
    let pending = state.pending
    check(pending != nil && state.view == nil && state.error != nil && state.canSave && !state.canRemove, "Unknown city result allowed a new edit")
    state.input = "Bruxelles"; await probe.configure(); await state.save(removing: true)
    let retried = await probe.changes
    check(retried.suffix(2).allSatisfy { $0 == pending } && state.view?.city == "Namur" && state.view?.revision == 3,
        "City retry replaced the unresolved UUID, expected version or city")
    await probe.configure(reply: .init(userId: "other", city: "Private", revision: 4)); state.input = "Wavre"; await state.save()
    check(state.view == nil && state.pending != nil && state.error != nil, "Foreign save receipt was accepted")
    let held = state.pending
    await probe.configure(failure: true); await state.refresh()
    check(state.view == nil && state.pending == held && state.canSave, "Failed reload discarded an unresolved city identity")
    await probe.configure(); await state.refresh()
    check(state.view?.city == "Wavre" && state.view?.revision == 4 && state.pending == nil && state.error == nil,
        "Explicit fresh city read did not resolve the unknown write")
    await probe.configure(reply: .init(userId: "parent", city: "Lie\u{0300}ge", revision: 4)); await state.refresh()
    check(state.view == nil && state.error != nil, "Typed noncanonical city bypassed validation")
    await probe.configure(reply: .init(userId: "parent", city: "Wavre", revision: ProfileCityWire.maximumRevision)); await state.refresh()
    state.input = "Liège"; check(!state.canSave && !state.canRemove, "Exhausted city revision accepted another write")
    state.close(); let before = await probe.calls; await state.resume(); await state.refresh(); await state.save()
    let after = await probe.calls
    check(before == after && state.view == nil && state.input.isEmpty && state.pending == nil, "Closed city editor retained data or dispatched")
    print("ProfileCityStateChecks passed: normalized save/removal, exact receipt, immutable unknown-write retry, failed/fresh resolution, malformed typed replies, revision exhaustion and closed-view denial; controlled gateways only")
}

@MainActor func checkProfileCityBoundaries() async {
    var count = 0
    for method in ["read", "save"] { for failing in [false, true] {
        for mode in ["logout", "same-uid", "other-uid", "role-roundtrip", "roles-revoked", "close", "background", "cancel"] {
            let scope = isolatedTeamScope(), probe = ProfileCityProbe()
            let state = ProfileCityState(access: scope.access!, gateway: probe)
            if method == "save" { await state.refresh(); state.input = "Liège" }
            let before = await probe.calls.count; await probe.configure(suspended: true)
            let task = Task { if method == "read" { await state.refresh() } else { await state.save() } }
            await probe.waitForCall(after: before)
            check(state.busy && scope.busy && state.view == nil, "City callback did not retain account work or exposed optimistic data")
            await state.refresh(); await state.save()
            if mode == "close" { state.close() }
            else if mode == "background" { state.suspend(); await state.resume() }
            else if mode == "cancel" { task.cancel() }
            else if mode == "role-roundtrip" {
                scope.replace(session: .init(uid: "parent", email: nil, displayName: nil, roles: [.parent, .driver]), role: .driver)
                replaceCityAccount(scope)
            } else if mode == "roles-revoked" {
                scope.replace(session: .init(uid: "parent", email: nil, displayName: nil, roles: [.driver]), role: .parent)
            } else {
                scope.clear(); if mode != "logout" { replaceCityAccount(scope, uid: mode == "same-uid" ? "parent" : "other") }
            }
            await state.refresh(); await state.save()
            if !["close", "background", "cancel"].contains(mode), let fresh = scope.access {
                check(fresh.begin() == nil, "A replacement account crossed an unsettled city callback")
            }
            check(scope.busy && state.busy, "City invalidation released the actual callback prematurely")
            await probe.release(failing: failing); await task.value
            let calls = await probe.calls
            check(calls.count == before + 1, "Stale city work dispatched a duplicate or follow-up")
            check(state.view == nil && state.pending == nil && state.input.isEmpty && state.error == nil && state.notice == nil && !scope.busy && !state.busy,
                "Late city response restored private data, intent or feedback")
            count += 1
        }
    }}
    print("ProfileCityBoundaryChecks passed: \(count) delayed read/save success/error boundaries across account/role generations, close, background and cancellation; no stale restoration, duplicate requests or early lease release")
}
@MainActor private func replaceCityAccount(_ scope: AccountWorkScope, uid: String = "parent") {
    scope.replace(session: .init(uid: uid, email: nil, displayName: nil, roles: [.parent, .driver]), role: .parent)
}
