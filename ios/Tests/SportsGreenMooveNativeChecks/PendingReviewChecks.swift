import Foundation

private actor ReviewFixture: PendingReviewGateway {
    var failure = false
    func fail(_ value: Bool) { failure = value }
    func loadPendingReviews(cursor: String) async throws -> PendingReviewPage {
        if failure { throw ProviderConfigurationError(message: "offline") }
        return .init(userId: "parent", items: cursor == "one" ? [] : [review("late")], nextCursor: cursor == "one" ? "two" : nil)
    }
}
private actor DelayedReviewFixture: PendingReviewGateway {
    private var reply: CheckedContinuation<PendingReviewPage, Never>?
    var waiting: Bool { reply != nil }
    func loadPendingReviews(cursor: String) async throws -> PendingReviewPage {
        await withCheckedContinuation { reply = $0 }
    }
    func finish() { reply?.resume(returning: .init(userId: "parent", items: [review("stale")], nextCursor: nil)); reply = nil }
}
private func review(_ id: String) -> InboxReviewPrompt {
    .init(id: id, rideSessionId: id, ratedUserId: "driver", title: "Avis", prompt: "Votre avis ?", initials: "AV")
}

@MainActor func checkPendingReviews() async throws {
    let wire: [String: Any] = ["userId": "parent", "items": [["id": "ride_parent_driver", "rideSessionId": "ride",
        "ratedUserId": "driver", "title": "Avis", "prompt": "Votre avis ?", "initials": "AV", "tripContext": NSNull()]], "nextCursor": NSNull()]
    let page = try PendingReviewWire.parse(wire, uid: "parent")
    check(page.items.count == 1 && page.nextCursor == nil, "Terminal review page failed")
    let context: [String: Any] = ["tripId": "trip", "title": "Entraînement U12", "departureAt": "2026-10-29T17:45:00Z",
                                "departureLabel": "29 octobre 2026 à 18:45"]
    let parsed = try ReviewTripContextWire.parse(["tripContext": context])
    check(parsed?.title == "Entraînement U12" && parsed?.departureLabel == "29 octobre 2026 à 18:45", "Review details changed")
    for bad in [[:], ["tripContext": false], ["tripContext": context.merging(["tripId": "foreign/path"], uniquingKeysWith: { _, b in b })],
                ["tripContext": context.merging(["departureAt": "2026-10-29T17:45:00"], uniquingKeysWith: { _, b in b })],
                ["tripContext": context.merging(["departureAt": "invalid"], uniquingKeysWith: { _, b in b })],
                ["tripContext": context.merging(["unexpected": true], uniquingKeysWith: { _, b in b })],
                ["tripContext": context.merging(["title": " "], uniquingKeysWith: { _, b in b })]] as [[String: Any]] {
        do { _ = try ReviewTripContextWire.parse(bad); fatalError("Invalid review details accepted") } catch { }
    }
    var invalid = wire; invalid["userId"] = "other"
    do { _ = try PendingReviewWire.parse(invalid, uid: "parent"); fatalError("Foreign review page was accepted") } catch { }
    invalid = wire; invalid.removeValue(forKey: "nextCursor")
    do { _ = try PendingReviewWire.parse(invalid, uid: "parent"); fatalError("Missing review cursor was accepted") } catch { }
    guard let rows = wire["items"] as? [[String: Any]] else { fatalError("Invalid review fixture") }
    invalid = wire; invalid["items"] = rows + rows
    do { _ = try PendingReviewWire.parse(invalid, uid: "parent"); fatalError("Duplicate review page was accepted") } catch { }
    let gateway = ReviewFixture(), state = PendingReviewsState()
    state.replace(.init(reviews: [], reviewsNextCursor: "one", reviewsUserId: "parent"))
    await state.more(gateway)
    check(state.items.isEmpty && state.nextCursor == "two", "Empty continuation was mistaken for no reviews")
    await gateway.fail(true); await state.more(gateway)
    check(state.error != nil && state.nextCursor == "two", "Failed review page consumed its cursor")
    await gateway.fail(false); await state.more(gateway)
    check(state.error == nil && state.items.count == 1 && state.nextCursor == nil, "Review retry failed")
    state.submitted("late"); state.replace(.init(reviews: [review("late")], reviewsNextCursor: nil, reviewsUserId: "parent"))
    check(state.items.isEmpty, "Submitted review reappeared on refresh")
    state.replace(.init(reviews: [review("other")], reviewsNextCursor: nil, reviewsUserId: "other"))
    check(state.items.map(\.id) == ["other"], "Account review state was not replaced")
    state.close(); check(state.items.isEmpty && state.nextCursor == nil, "Review disposal retained a page")
    let delayed = DelayedReviewFixture()
    state.replace(.init(reviews: [], reviewsNextCursor: "one", reviewsUserId: "parent"))
    let pending = Task { await state.more(delayed) }
    while !(await delayed.waiting) { await Task.yield() }
    state.close(); check(!state.loading, "Closing reviews retained a busy operation")
    state.replace(.init(reviews: [review("fresh")], reviewsNextCursor: nil, reviewsUserId: "other"))
    await delayed.finish(); await pending.value
    check(state.items.map(\.id) == ["fresh"] && state.nextCursor == nil, "Late review result leaked into another account")
    print("PendingReviewChecks passed")
}
