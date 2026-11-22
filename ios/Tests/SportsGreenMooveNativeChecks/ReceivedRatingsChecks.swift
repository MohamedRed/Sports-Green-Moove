import Foundation

func checkReceivedRatingsWire() throws {
    let raw: [String: Any] = ["userId": "parent", "count": 105, "average": 363.0 / 105]
    let received = try ReceivedRatingsWire.parse(raw, uid: "parent")
    check(received.count == 105 && received.average == 363.0 / 105, "Received ratings were rounded or capped at 100")
    let empty = try ReceivedRatingsWire.parse(["userId": "parent", "count": 0, "average": NSNull()], uid: "parent")
    check(empty.count == 0 && empty.average == nil, "Empty received ratings fabricated a star score")
    let maximum = try ReceivedRatingsWire.parse(["userId": "parent", "count": 9_007_199_254_740_991 as Int64, "average": 5], uid: "parent")
    check(maximum.count == 9_007_199_254_740_991, "Safe received-rating count was truncated")
    var invalid: [[String: Any]] = []
    for patch in [["userId": "other"], ["userId": NSNull()], ["count": true], ["count": -1], ["count": 0.5],
        ["count": Double.nan], ["count": Double.infinity], ["count": 9_007_199_254_740_992 as Int64], ["count": "105"],
        ["average": true], ["average": "4"], ["average": NSNull()], ["average": 0], ["average": 6],
        ["average": Double.nan], ["average": Double.infinity], ["count": 0, "average": 4]] as [[String: Any]] {
        invalid.append(raw.merging(patch) { _, next in next })
    }
    for key in ["userId", "count", "average"] { var value = raw; value.removeValue(forKey: key); invalid.append(value) }
    for value in invalid {
        do { _ = try ReceivedRatingsWire.parse(value, uid: "parent"); fatalError("Invalid or foreign received-rating aggregate was accepted") } catch { }
    }
    for value: Any? in [nil, [], "not-an-aggregate"] {
        do { _ = try ReceivedRatingsWire.parse(value, uid: "parent"); fatalError("Malformed received-rating envelope was accepted") } catch { }
    }
    do { _ = try ReceivedRatingsWire.parse(raw, uid: ""); fatalError("An empty account received an aggregate") } catch { }
    print("ReceivedRatingsWireChecks passed: 3 valid aggregates, \(invalid.count) malformed/foreign aggregate groups, 3 invalid envelopes and empty-account denial")
}

@MainActor func checkReceivedRatingsState() async {
    let scope = isolatedTeamScope(), probe = ReceivedRatingsProbe()
    let state = ReceivedRatingsState(access: scope.access!, gateway: probe)
    await state.refresh()
    check(state.summary?.count == 105 && state.error == nil && !state.busy && !scope.busy, "Current received ratings were not shown")
    await probe.configure(result: .init(userId: "other", count: 1, average: 5)); await state.refresh()
    check(state.summary == nil && state.error != nil, "Foreign ratings retained old profile data")
    await probe.configure(result: .init(userId: "parent", count: 0, average: 5)); await state.refresh()
    check(state.summary == nil && state.error != nil, "Invalid typed gateway values bypassed received-rating validation")
    await probe.configure(result: .init(userId: "parent", count: 0, average: nil)); await state.refresh()
    check(state.summary?.average == nil && state.summary?.count == 0 && state.error == nil, "Fresh empty ratings did not recover explicitly")
    state.suspend(); check(state.summary == nil && state.error == nil, "Backgrounded ratings retained private state")
    await state.resume(); check(state.summary?.count == 0, "Foreground ratings did not require a fresh read")
    state.close(); let before = await probe.calls; await state.resume(); await state.refresh(); let after = await probe.calls
    check(before == after && state.summary == nil, "Closed profile ratings dispatched again")
    var cases = 0
    for failing in [false, true] {
        for revoke in ["logout", "same-uid", "other-uid", "role-roundtrip", "roles-revoked", "close", "background", "cancel"] {
            let scope = isolatedTeamScope(), gateway = ReceivedRatingsProbe()
            let state = ReceivedRatingsState(access: scope.access!, gateway: gateway)
            await gateway.configure(suspended: true)
            let task = Task { await state.refresh() }; await gateway.waitForCall()
            check(state.busy && scope.busy, "Received-rating request did not retain its account lease")
            await state.refresh()
            if revoke == "close" { state.close() }
            else if revoke == "background" { state.suspend(); await state.resume() }
            else if revoke == "cancel" { task.cancel() }
            else if revoke == "role-roundtrip" {
                scope.replace(session: .init(uid: "parent", email: nil, displayName: nil, roles: [.parent, .driver]), role: .driver)
                replaceRatingAccount(scope)
            } else if revoke == "roles-revoked" {
                scope.replace(session: .init(uid: "parent", email: nil, displayName: nil, roles: [.driver]), role: .parent)
            } else {
                scope.clear()
                if revoke != "logout" { replaceRatingAccount(scope, uid: revoke == "same-uid" ? "parent" : "other") }
            }
            await state.refresh()
            if !["close", "background", "cancel"].contains(revoke), let fresh = scope.access {
                check(fresh.begin() == nil, "New profile request crossed an unsettled old rating callback")
            }
            check(scope.busy && state.busy, "Invalidation prematurely released the actual rating callback")
            await gateway.release(failing: failing); await task.value
            let calls = await gateway.calls
            check(calls == ["parent"], "Revoked rating request dispatched follow-up or duplicate work")
            check(state.summary == nil && state.error == nil && !scope.busy && !state.busy,
                "Late received-rating success/error restored another generation or leaked account work")
            cases += 1
        }
    }
    print("ReceivedRatingsStateChecks passed: explicit refresh, foreign/invalid denial, empty recovery, foreground reload and \(cases) delayed success/error account/role/lifecycle/cancellation boundaries; controlled gateways only")
}

@MainActor private func replaceRatingAccount(_ scope: AccountWorkScope, uid: String = "parent") {
    scope.replace(session: .init(uid: uid, email: nil, displayName: nil, roles: [.parent, .driver]), role: .parent)
}
