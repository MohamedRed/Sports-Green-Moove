import Foundation

private actor MessagesProbe: MessagesGateway {
    private var reply: CheckedContinuation<Void, Error>?
    private var suspended = false
    private var calls: [String] = []
    var waiting: Bool { reply != nil }
    var names: [String] { calls }
    var owner = "parent"
    var ratingId = "ride_parent_driver"
    func configure(suspend: Bool = false, owner: String = "parent", ratingId: String = "ride_parent_driver") {
        suspended = suspend; self.owner = owner; self.ratingId = ratingId
    }
    func release(failing: Bool) {
        if failing { reply?.resume(throwing: ProviderConfigurationError(message: "isolated failure")) }
        else { reply?.resume() }
        reply = nil
    }
    private func call(_ name: String, uid: String) async throws {
        check(uid == "parent", "Messages gateway adopted an unowned account")
        calls.append(name)
        if suspended { suspended = false; try await withCheckedThrowingContinuation { reply = $0 } }
    }
    func getInbox(uid: String) async throws -> InboxSummary {
        try await call("inbox", uid: uid)
        return .init(notifications: [.init(id: "private-note", title: "Private", body: "Isolated", dateLabel: "Today", unread: true, initials: "QA")],
            reviews: [messagesReview()], reviewsNextCursor: "next", reviewsUserId: owner)
    }
    func loadPendingReviews(uid: String, cursor: String) async throws -> PendingReviewPage {
        try await call("page", uid: uid)
        check(cursor == "next", "Messages changed the captured page cursor")
        return .init(userId: owner, items: [messagesReview(id: "second")], nextCursor: nil)
    }
    func submitRating(uid: String, rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String {
        check(rideSessionId == "ride" && ratedUserId == "driver" && score == 5 && comment == nil, "Rating changed displayed input")
        try await call("rating", uid: uid); return ratingId
    }
}

private func messagesReview(id: String = "review") -> InboxReviewPrompt {
    .init(id: id, rideSessionId: "ride", ratedUserId: "driver", title: "Avis", prompt: "Votre avis ?", initials: "QA",
        tripContext: .init(tripId: "trip", title: "Entraînement", departureAt: "2026-11-30T12:00:00Z", departureLabel: "30 novembre"))
}
@MainActor private func messagesScope(_ uid: String = "parent") -> AccountWorkScope {
    let scope = AccountWorkScope(); replaceMessagesAccount(scope, uid: uid); return scope
}
@MainActor private func replaceMessagesAccount(_ scope: AccountWorkScope, uid: String = "parent", role: AppRole = .parent) {
    scope.replace(session: .init(uid: uid, email: nil, displayName: nil, roles: [.parent, .driver]), role: role)
}
@MainActor private func executeMessages(_ state: MessagesInboxState, method: String) async {
    switch method {
    case "inbox": await state.refresh()
    case "page": await state.more()
    default: await state.submit(messagesReview(), score: 5)
    }
}

@MainActor func checkMessagesInboxOwnership() async {
    var count = 0
    for method in ["inbox", "page", "rating"] {
        for failing in [false, true] {
            for revoke in ["logout", "same-uid", "other-uid", "role-roundtrip", "close", "background", "cancel"] {
                let scope = messagesScope(), probe = MessagesProbe()
                let state = MessagesInboxState(access: scope.access!, gateway: probe)
                if method != "inbox" { await state.refresh() }
                await probe.configure(suspend: true)
                let task = Task { await executeMessages(state, method: method) }
                while !(await probe.waiting) { await Task.yield() }
                check(state.busy && scope.busy, "Messages work was not retained")
                let before = await probe.names
                await executeMessages(state, method: method)
                if revoke == "cancel" { task.cancel() }
                else if revoke == "close" { state.close() }
                else if revoke == "background" { state.suspend() }
                else if revoke == "role-roundtrip" {
                    replaceMessagesAccount(scope, role: .driver); replaceMessagesAccount(scope)
                } else {
                    scope.clear()
                    if revoke != "logout" { replaceMessagesAccount(scope, uid: revoke == "same-uid" ? "parent" : "other") }
                }
                if let fresh = scope.access, revoke != "close" && revoke != "background" && revoke != "cancel" {
                    check(fresh.begin() == nil, "New account work crossed an unsettled message request")
                }
                if revoke == "background" { await state.resume() }
                await executeMessages(state, method: method)
                check(state.busy, "Invalidation released an unsettled messages operation")
                await probe.release(failing: failing); await task.value
                let after = await probe.names
                check(before == after, "Messages duplicated a request or issued stale follow-up work")
                check(state.inbox == InboxSummary() && state.reviews.items.isEmpty && state.reviews.nextCursor == nil,
                    "Delayed messages restored private content")
                check(state.error == nil && state.notice == nil && !state.busy && !scope.busy,
                    "Delayed messages restored feedback or leaked a lease")
                count += 1
            }
        }
    }
    await checkCurrentMessages()
    print("MessagesInboxChecks passed: \(count) delayed inbox/page/rating success/error boundaries; exact account generations, lifecycle, cancellation, duplicate denial and drainage")
}

@MainActor private func checkCurrentMessages() async {
    let scope = messagesScope(), probe = MessagesProbe()
    let state = MessagesInboxState(access: scope.access!, gateway: probe)
    await state.refresh()
    check(state.inbox.notifications.map(\.id) == ["private-note"] && state.reviews.items == [messagesReview()], "Current inbox did not load")
    await state.submit(messagesReview(), score: 0)
    await state.submit(messagesReview(id: "foreign"), score: 5)
    let before = await probe.names
    check(before == ["inbox"], "Unshown or invalid rating was dispatched")
    await state.more()
    check(state.reviews.items.count == 2, "Current review continuation was not appended")
    await state.submit(messagesReview(), score: 5)
    check(state.notice == "Avis envoyé." && !state.reviews.items.contains(messagesReview()), "Current rating receipt was lost")
    await state.refresh()
    check(!state.reviews.items.contains(messagesReview()), "Acknowledged rating reappeared on refresh")
    state.suspend()
    check(state.inbox == InboxSummary() && state.reviews.items.isEmpty, "Suspending messages retained private content")
    await state.resume()
    check(state.reviews.items == [messagesReview()], "Resuming messages did not explicitly reload")
    await probe.configure(suspend: true)
    let failure = Task { await state.submit(messagesReview(), score: 5) }
    while !(await probe.waiting) { await Task.yield() }
    await probe.release(failing: true); await failure.value
    let failedNames = await probe.names
    await state.submit(messagesReview(), score: 5)
    let unchangedNames = await probe.names
    check(state.error != nil && !state.canSubmit && unchangedNames == failedNames, "Uncertain rating was resent before a read")
    await state.refresh(); await state.submit(messagesReview(), score: 5)
    check(state.notice != nil && state.error == nil, "Explicit refresh and rating retry failed")
    for wrong in ["", "foreign/path", "other_parent_driver", "ride_foreign_driver"] {
        state.suspend(); await state.resume(); await probe.configure(ratingId: wrong)
        await state.submit(messagesReview(), score: 5)
        check(state.error != nil && state.notice == nil, "Malformed rating receipt was accepted")
    }
    await probe.configure(owner: "foreign")
    await state.refresh()
    check(state.inbox == InboxSummary() && state.reviews.items.isEmpty && state.error != nil, "Foreign inbox was accepted")
    let access = scope.access!
    replaceMessagesAccount(scope)
    await executeMessages(state, method: "inbox")
    await state.more(); await state.submit(messagesReview(), score: 5)
    check(!access.isCurrent && !scope.busy, "Old screen adopted a new same-UID session")
    print("Current messages passed: exact displayed review, pagination, invalid/unshown denial, acknowledged suppression, explicit refresh, unknown-write denial and malformed/foreign receipt rejection")
}
