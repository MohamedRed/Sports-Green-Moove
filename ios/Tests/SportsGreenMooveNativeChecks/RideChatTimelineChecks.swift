import Foundation

func checkRideChatTimeline() throws {
    var timeline = RideChatTimeline()
    try timeline.latest(rideChatPage())
    check(timeline.messages.count == 50 && timeline.older == rideChatRow(2).position, "Initial fifty-row window incomplete")
    try timeline.earlier(rideChatPage(1...1, more: false), after: timeline.older!)
    check(timeline.messages.count == 51 && timeline.older == nil, "Earlier history was truncated")
    try timeline.latest(rideChatPage(3...52))
    check(timeline.messages.count == 52 && timeline.older == nil, "Overlapping head erased retained history")
    try timeline.latest(rideChatPage(103...152))
    check(timeline.older == rideChatRow(103).position, "Disconnected live window did not create gap cursor")
    try timeline.earlier(rideChatPage(53...102), after: timeline.older!)
    check(timeline.older == rideChatRow(53).position, "Multi-page bridge was not retained")
    try timeline.earlier(rideChatPage(3...52), after: timeline.older!)
    check(timeline.messages.count == 152 && timeline.older == nil, "Live/history bridge lost or duplicated messages")
    timeline.markRead([rideChatRow(52).id]); try timeline.latest(rideChatPage(103...152))
    check(timeline.messages.first { $0.id == rideChatRow(52).id }?.needsRead == false, "Read acknowledgement regressed")
    rideChatReject("immutable message replacement") {
        try timeline.latest(.init(uid: rideChatOwner, reference: rideChatReference, messages: [rideChatRow(152, body: "Different")], older: nil))
    }
    try timeline.latest(rideChatPage(151...152, more: false))
    check(timeline.messages.count == 2 && timeline.older == nil, "Authoritative history contraction retained deleted rows")
    try timeline.latest(.init(uid: rideChatOwner, reference: rideChatReference, messages: [], older: nil))
    check(timeline.messages.isEmpty, "Authoritative empty history retained private rows")
    rideChatReject("misordered messages") { try timeline.latest(.init(uid: rideChatOwner, reference: rideChatReference, messages: [rideChatRow(1), rideChatRow(2)], older: nil)) }
    rideChatReject("duplicate messages") { _ = try RideChatMessageWire.page([rideChatRow(1), rideChatRow(1)], uid: rideChatOwner, reference: rideChatReference) }
    var directory = RideChatDirectoryTimeline(uid: rideChatOwner)
    try directory.latest(rideChatDirectoryPage((22...41).reversed().map { rideChatDirectoryRow($0) }, next: "older"))
    try directory.earlier(rideChatDirectoryPage((2...21).reversed().map { rideChatDirectoryRow($0) }, next: "last"), cursor: "older")
    try directory.earlier(rideChatDirectoryPage([rideChatDirectoryRow(1)]), cursor: "last")
    check(directory.items.count == 41 && directory.nextCursor == nil, "Directory pagination lost older conversations")
    try directory.latest(rideChatDirectoryPage((23...42).reversed().map { rideChatDirectoryRow($0) }, next: "next-head"))
    check(directory.items.count == 42 && directory.nextCursor == nil, "Directory overlap lost completed history")
    try directory.latest(rideChatDirectoryPage([rideChatDirectoryRow(42, revision: 3, unread: 0)]))
    try directory.latest(rideChatDirectoryPage([rideChatDirectoryRow(42, revision: 1, unread: 2)]))
    check(directory.items.first?.revision == 3 && directory.items.first?.unreadCount == 0, "Stale directory response replaced newer revision")
    rideChatReject("equal revision with conflicting counter") { try directory.latest(rideChatDirectoryPage([rideChatDirectoryRow(42, revision: 3, unread: 8)])) }
    directory.remove(rideChatDirectoryRow(42).reference)
    check(directory.items.isEmpty, "Source revocation retained directory context")
    var loop = RideChatDirectoryTimeline(uid: rideChatOwner)
    try loop.latest(rideChatDirectoryPage([rideChatDirectoryRow(3)], next: "same"))
    rideChatReject("cursor loop") { try loop.earlier(rideChatDirectoryPage([rideChatDirectoryRow(2)], next: "same"), cursor: "same") }
    print("RideChatTimelineChecks passed: fifty-row windows, 152-message gap closure, complete directory pagination, read monotonicity, immutable rows, authoritative deletion and revision/cursor denial")
}
