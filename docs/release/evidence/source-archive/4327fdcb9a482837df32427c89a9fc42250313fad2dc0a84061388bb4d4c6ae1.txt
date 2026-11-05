import Foundation

@MainActor func checkRideChatDirectory() async throws {
    let scope = rideChatScope(), probe = RideChatProbe()
    probe.inbox.autoGrant = false
    let state = RideChatDirectoryState(uid: rideChatOwner, access: scope.access!, gateway: probe)
    let run = Task { await state.run() }
    await rideChatEventually({ state.loaded }, "Directory never loaded")
    check(state.items.isEmpty && state.verifying && state.unreadCount == nil, "Unverified directory exposed content or fake zero badge")
    let reference = probe.directory.items[0].reference
    probe.inbox.source(reference, [rideChatOwner, rideChatDriver])
    await rideChatEventually({ state.items.count == 1 }, "Fresh current source did not unlock row")
    check(state.unreadCount == 2 && state.selected(state.items[0]) != nil, "Complete authorized directory unread count wrong")
    probe.suspended = true; probe.inbox.changed()
    await rideChatEventually({ probe.reply != nil }, "Directory refresh never started")
    probe.inbox.source(reference, [rideChatDriver])
    await rideChatEventually({ state.items.isEmpty }, "Revocation waited behind pending directory RPC")
    probe.release()
    await rideChatEventually({ !state.busy }, "Directory refresh never drained")
    check(state.items.isEmpty, "Delayed authorized-looking index resurrected revoked source")
    probe.inbox.source(reference, [rideChatOwner, rideChatDriver]); await Task.yield()
    check(state.items.isEmpty, "Revoked source silently regained access without fresh directory opening")
    state.close(); await run.value
    check(!scope.busy && !probe.inbox.isCurrent && state.unreadCount == nil, "Closing directory retained observer, badge or lease")
    let freshProbe = RideChatProbe(), fresh = RideChatDirectoryState(uid: rideChatOwner, access: scope.access!, gateway: freshProbe)
    freshProbe.directory = rideChatDirectoryPage([rideChatDirectoryRow(3)], next: "next")
    let freshRun = Task { await fresh.run() }
    await rideChatEventually({ fresh.items.count == 1 }, "Paged directory never loaded")
    check(fresh.hasMore && fresh.unreadCount == nil, "Partial directory advertised an exact unread total")
    freshProbe.directory = rideChatDirectoryPage([rideChatDirectoryRow(2)])
    await fresh.more(); await rideChatEventually({ fresh.items.count == 2 }, "Directory continuation lost older row")
    check(fresh.unreadCount == 4 && !fresh.hasMore, "Complete paged directory failed exact unread aggregate")
    fresh.suspend(); await freshRun.value
    let bookingProbe = RideChatProbe(), choices = RideChatBookingState(uid: rideChatOwner, access: scope.access!, gateway: bookingProbe)
    bookingProbe.bookings = .init(uid: rideChatOwner, items: [], nextCursor: "page-two")
    await choices.run()
    check(choices.loaded && choices.items.isEmpty && choices.hasMore, "Empty scanned booking page suppressed continuation")
    bookingProbe.bookings = .init(uid: rideChatOwner, items: [.init(reference: rideChatReference, context: rideChatContext, status: .approved)], nextCursor: nil)
    await choices.more()
    check(choices.items.count == 1 && choices.selected(choices.items[0]) != nil && !choices.hasMore, "Booking chooser did not open exact displayed choice")
    choices.close(); check(choices.items.isEmpty, "Closing chooser retained private booking context")
    print("RideChatDirectoryChecks passed: fresh source before display, revocation during pending RPC, no resurrection, exact complete-only unread total, multi-page and empty booking continuation")
}
