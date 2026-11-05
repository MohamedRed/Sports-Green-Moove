import Foundation

func checkTeamChatTimeline() throws {
    var timeline = TeamChatTimeline()
    try timeline.latest(isolatedTeamPage([isolatedTeamMessage(4)], cursor: "first"))
    try timeline.earlier(isolatedTeamPage([isolatedTeamMessage(3)], cursor: "tail"), requested: "first")
    try timeline.latest(isolatedTeamPage([isolatedTeamMessage(9), isolatedTeamMessage(8)], cursor: "gap-one"))
    check(timeline.messages.map(\.sequence) == [9, 8, 4, 3] && timeline.olderCursor == "gap-one", "New team head lost earlier history or its gap cursor")
    try timeline.earlier(isolatedTeamPage([isolatedTeamMessage(7), isolatedTeamMessage(6)], cursor: "gap-two"), requested: "gap-one")
    try timeline.earlier(isolatedTeamPage([isolatedTeamMessage(5), isolatedTeamMessage(4)], cursor: "first"), requested: "gap-two")
    check(timeline.messages.map(\.sequence) == [9, 8, 7, 6, 5, 4, 3] && timeline.olderCursor == "tail", "Known team history did not close the new gap")
    try timeline.earlier(isolatedTeamPage([isolatedTeamMessage(2), isolatedTeamMessage(1)]), requested: "tail")
    check(timeline.messages.count == 9 && timeline.olderCursor == nil, "Team history ended before all requested pages")
    try timeline.latest(isolatedTeamPage([isolatedTeamMessage(10)]))
    check(timeline.messages.map(\.sequence) == [10] && timeline.olderCursor == nil, "Complete server history retained removed messages")
    try timeline.latest(isolatedTeamPage([]))
    check(timeline.messages.isEmpty, "Complete empty history retained private messages")
    var corrupt = TeamChatTimeline()
    let row = isolatedTeamMessage(5)
    try corrupt.latest(isolatedTeamPage([row], cursor: "one"))
    let changed = TeamChatMessage(id: row.id, senderId: row.senderId, author: row.author, body: "Changed body", requestId: row.requestId,
        sequence: row.sequence, seconds: row.seconds, nanos: row.nanos, needsRead: row.needsRead)
    do { try corrupt.latest(isolatedTeamPage([changed], cursor: "new")); fatalError("Immutable team message changed") } catch { }
    check(corrupt.messages == [row] && corrupt.olderCursor == "one", "Rejected team merge partially changed history")
    do { try corrupt.earlier(isolatedTeamPage([isolatedTeamMessage(4)], cursor: "one"), requested: "one"); fatalError("Self cursor accepted") } catch { }
    try corrupt.earlier(isolatedTeamPage([isolatedTeamMessage(4)], cursor: "two"), requested: "one")
    do { try corrupt.earlier(isolatedTeamPage([isolatedTeamMessage(3)], cursor: "one"), requested: "two"); fatalError("Cursor cycle accepted") } catch { }
    check(corrupt.messages.map(\.sequence) == [5, 4] && corrupt.olderCursor == "two", "Rejected cursor cycle mutated cached history")
    print("TeamChatTimelineChecks passed: overlapping and disconnected heads, multi-page gap closure, full older history, authoritative contraction/empty history, immutable rows and cursor-cycle rejection")
}

@MainActor func checkTeamChatDirectory() async throws {
    let scope = isolatedTeamScope(), gateway = TeamChatProbe()
    let state = TeamChatDirectoryState(access: scope.access!, clubId: nil, gateway: gateway)
    await gateway.configure(choices: .init(items: [], nextCursor: "more")); await state.refresh()
    check(state.items.isEmpty && state.hasMore && state.loaded, "Empty authorized option page lost its continuation")
    let hidden = TeamChatChoice(id: "hidden", name: nil, instanceId: nil, unreadCount: nil)
    let club = TeamChatChoice(id: "club", name: "Synthetic club", instanceId: nil, unreadCount: nil)
    await gateway.configure(choices: .init(items: [hidden, club], nextCursor: nil)); await state.more()
    check(state.select(hidden) == nil && state.select(.init(id: "foreign", name: "Foreign", instanceId: nil, unreadCount: nil)) == nil,
        "Unlisted or redacted team option was selected")
    check(state.select(club) == club, "Authorized exact club could not be selected")
    await state.refresh()
    check(!state.loaded && state.items.isEmpty, "Closed team selection reopened itself")
    let page = TeamChatDirectoryState(access: scope.access!, clubId: "club", gateway: gateway)
    let team = TeamChatChoice(id: "team", name: "Synthetic team", instanceId: isolatedTeamTarget.instanceId, unreadCount: 2)
    await gateway.configure(choices: .init(items: [team], nextCursor: "next")); await page.refresh()
    await gateway.configure(choices: .init(items: [team], nextCursor: nil)); await page.more()
    check(page.error != nil && page.items.isEmpty, "Duplicate team option did not fail closed")
    for role in [AppRole.child, .admin] {
        let rejected = isolatedTeamScope(role: role, roles: [role]), probe = TeamChatProbe()
        let directory = TeamChatDirectoryState(access: rejected.access!, clubId: nil, gateway: probe)
        await directory.refresh(); let calls = await probe.names
        check(calls.isEmpty && !directory.loaded, "Child/admin discovered a team without an adult selected role")
    }
    print("TeamChatDirectoryChecks passed: empty-page continuation, exact/redacted choice handling, closed-view denial, duplicate failure and child/admin role rejection")
}
