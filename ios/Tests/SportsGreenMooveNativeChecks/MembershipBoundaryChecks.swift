import Foundation

@MainActor func checkMembershipBoundaries() async {
    var cases = 0
    for method in ["catalog", "catalog-more", "request", "choices", "choices-more", "reviews", "reviews-more", "decide"] {
        for failing in [false, true] {
            for revoke in ["logout", "same-uid", "other-uid", "role-roundtrip", "roles-revoked", "close", "background", "cancel"] {
                let review = ["choices", "choices-more", "reviews", "reviews-more", "decide"].contains(method)
                let scope = isolatedTeamScope(role: .clubManager, roles: [.clubManager, .parent]), gateway = MembershipProbe()
                let directory = ClubMembershipState(access: scope.access!, gateway: gateway)
                let manager = MembershipReviewState(access: scope.access!, gateway: gateway)
                if ["request", "catalog-more"].contains(method) {
                    await gateway.configure(cursor: method == "catalog-more" ? "next" : nil); await directory.refresh()
                } else if method != "catalog" && method != "choices" {
                    await gateway.configure(cursor: method == "choices-more" ? "next" : nil); await manager.refresh()
                    if method != "choices-more" {
                        await gateway.configure(cursor: method == "reviews-more" ? "next" : nil); await manager.select(manager.clubs[0])
                    }
                }
                let count = await gateway.calls.count
                await gateway.configure(clubs: [membershipClub("later")], rows: [membershipRow()], choices: [.init(id: "later", name: "Later club")], suspended: true)
                let task = Task { await membershipAction(method, directory, manager) }
                await gateway.waitForCall(count + 1)
                check(scope.busy, "Membership callback did not retain account work")
                await membershipAction(method, directory, manager)
                if revoke == "cancel" { task.cancel() }
                else if revoke == "close" { directory.close(); manager.close() }
                else if revoke == "background" {
                    directory.suspend(); manager.suspend()
                    if review { await manager.resume() } else { await directory.resume() }
                } else if revoke == "role-roundtrip" {
                    scope.replace(session: .init(uid: "parent", email: nil, displayName: nil, roles: [.clubManager, .parent]), role: .parent)
                    replaceMembershipScope(scope)
                } else if revoke == "roles-revoked" { scope.clear() }
                else {
                    scope.clear()
                    if revoke != "logout" { replaceMembershipScope(scope, uid: revoke == "same-uid" ? "parent" : "other") }
                }
                await membershipAction(method, directory, manager)
                if !["close", "background", "cancel"].contains(revoke), let fresh = scope.access {
                    check(fresh.begin() == nil, "New membership account work crossed an unsettled old callback")
                }
                check(scope.busy, "Membership invalidation released work before its actual callback")
                await gateway.release(failing: failing); await task.value
                let calls = await gateway.calls
                check(calls.count == count + 1, "Stale membership request started duplicate/follow-up work: \(method)/\(revoke)/\(failing)")
                check(directory.items.isEmpty && directory.error == nil && directory.writeError == nil && !directory.loaded,
                    "Revoked catalog restored private data or feedback")
                check(manager.items.isEmpty && manager.clubs.isEmpty && manager.club == nil && manager.error == nil && manager.writeError == nil && !manager.loaded,
                    "Revoked manager request restored private data or feedback")
                check(!scope.busy && !directory.busy && !manager.busy, "Membership callback leaked account work")
                cases += 1
            }
        }
    }
    print("MembershipBoundaryChecks passed: \(cases) delayed catalog/request/review-list/decision success/error cases across account/role generations, close, background and cancellation; no stale restoration, duplicate work or premature lease release")
}
@MainActor private func replaceMembershipScope(_ scope: AccountWorkScope, uid: String = "parent") {
    scope.replace(session: .init(uid: uid, email: nil, displayName: nil, roles: [.clubManager, .parent]), role: .clubManager)
}
@MainActor private func membershipAction(_ method: String, _ directory: ClubMembershipState, _ manager: MembershipReviewState) async {
    switch method {
    case "catalog": await directory.refresh()
    case "catalog-more": await directory.more()
    case "request": if let row = directory.items.first { _ = await directory.request(row) }
    case "choices", "reviews": await manager.refresh()
    case "choices-more", "reviews-more": await manager.more()
    default: if let row = manager.items.first { _ = await manager.decide(row, decision: .approve) }
    }
}
