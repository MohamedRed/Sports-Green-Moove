import Foundation

@MainActor func checkMembershipState() async {
    let scope = isolatedTeamScope(), gateway = MembershipProbe(), state = ClubMembershipState(access: scope.access!, gateway: MembershipProbe())
    let clubs = ClubMembershipState(access: scope.access!, gateway: gateway)
    await clubs.refresh(); check(clubs.canRequest && clubs.items.count == 1, "Club directory did not load")
    let original = clubs.items[0]
    let accepted = await clubs.request(original)
    check(accepted && clubs.requiresRefresh && clubs.items[0].membership == nil && !clubs.canRequest, "Request confirmation invented a local membership state")
    let oldCalls = await gateway.calls; _ = await clubs.request(original); let deniedCalls = await gateway.calls
    check(oldCalls == deniedCalls, "Repeated request bypassed fresh readback")
    await clubs.refresh(); check(clubs.items[0].membership?.status == "requested" && !clubs.items[0].requestable, "Pending request did not survive fresh readback")
    await gateway.configure(clubs: [membershipClub(status: "rejected")]); await clubs.refresh()
    check(clubs.items[0].requestable, "Rejected membership cannot request again")
    await gateway.configure(malformed: true); let failed = await clubs.request(clubs.items[0])
    check(!failed && clubs.writeError != nil && !clubs.canRequest, "Foreign write receipt permitted another request")
    await gateway.configure(clubs: [membershipClub(status: "active")]); await clubs.refresh()
    check(clubs.items[0].membership?.isActive == true && !clubs.items[0].requestable, "Fresh active readback was not distinguished from pending")
    await gateway.configure(clubs: [], malformed: true); await clubs.refresh()
    check(clubs.items.isEmpty && clubs.error != nil, "Foreign directory retained old clubs")
    await gateway.configure(cursor: "next", clubs: []); await clubs.refresh(); check(clubs.hasMore, "Empty scanned directory lost its continuation")
    await gateway.configure(clubs: [membershipClub("later")]); await clubs.more(); check(clubs.items.first?.id == "later", "Later catalog page was lost")
    state.close(); await state.resume(); check(state.items.isEmpty, "Closed membership state resumed")
    await checkMembershipDecisions()
    print("MembershipStateChecks passed: real-readback-only request state, unknown/foreign receipt lock, explicit recovery, re-request, fresh active state, empty continuation and closed-view denial; controlled gateways only")
}

@MainActor private func checkMembershipDecisions() async {
    let scope = isolatedTeamScope(role: .clubManager, roles: [.clubManager]), gateway = MembershipProbe()
    let state = MembershipReviewState(access: scope.access!, gateway: gateway)
    await state.refresh(); await state.select(state.clubs[0])
    let row = state.items[0]; let accepted = await state.decide(row, decision: .approve)
    check(accepted && state.requiresRefresh && !state.canDecide && state.items[0].status == "requested", "Decision invented a local approval before readback")
    await state.refresh(); check(state.items[0].status == "active" && !state.items[0].canDecide, "Fresh manager approval was not read back")
    let calls = await gateway.calls; _ = await state.decide(row, decision: .reject); let after = await gateway.calls
    check(calls == after, "An old displayed version remained actionable after review")
    await gateway.configure(rows: [membershipRow(version: "1700000000.3")]); await state.refresh()
    await gateway.configure(malformed: true); let invalid = await state.decide(state.items[0], decision: .reject)
    check(!invalid && state.writeError != nil && state.requiresRefresh, "Foreign manager receipt was accepted")
    await gateway.configure(rows: [membershipRow(version: "1700000000.4")]); await state.refresh()
    let rejected = await state.decide(state.items[0], decision: .reject); check(rejected, "Current request could not be rejected")
    await state.refresh(); check(state.items[0].status == "rejected" && !state.items[0].active, "Rejection did not use fresh server state")
    await gateway.configure(malformed: true); await state.refresh()
    check(state.items.isEmpty && state.club == nil && state.error != nil, "Invalid authority retained a private club or member list")
    for role in [AppRole.parent, .driver, .child] {
        let other = isolatedTeamScope(role: role, roles: [role]), probe = MembershipProbe()
        let denied = MembershipReviewState(access: other.access!, gateway: probe); await denied.refresh(); let calls = await probe.calls
        check(calls.isEmpty && denied.items.isEmpty, "Non-manager opened membership reviews")
    }
    let child = isolatedTeamScope(role: .child, roles: [.child]), probe = MembershipProbe()
    let directory = ClubMembershipState(access: child.access!, gateway: probe); await directory.refresh()
    _ = await directory.request(directory.items[0]); let childCalls = await probe.calls
    check(childCalls == ["catalog"], "Child login requested its own adult club membership")
    print("MembershipReviewStateChecks passed: approval/rejection readback, exact displayed version, foreign receipt lock, current authority reload, private-data scrubbing and non-manager/child denial")
}
