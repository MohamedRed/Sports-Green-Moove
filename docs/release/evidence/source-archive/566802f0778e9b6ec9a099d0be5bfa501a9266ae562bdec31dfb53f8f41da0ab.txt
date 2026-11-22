import Foundation

struct RideChatDirectoryTimeline {
    private struct Cursor { let token: String; let after: RideChatPosition; let stopAt: RideChatPosition? }
    private let uid: RideChatID
    private var records: [RideChatID: RideChatDirectoryRow] = [:]
    private var cursors: [Cursor] = []
    private var consumed = Set<String>()
    private var newest: RideChatPosition?
    private var initialized = false
    init(uid: RideChatID) { self.uid = uid }
    var items: [RideChatDirectoryRow] { records.values.sorted { $0.position > $1.position } }
    var nextCursor: String? { cursors.first?.token }
    mutating func latest(_ page: RideChatDirectoryPage) throws {
        try validate(page)
        if page.nextCursor == nil {
            let ids = Set(page.items.map(\.id)); records = records.filter { ids.contains($0.key) }; cursors = []; consumed = []
        } else if !initialized || (newest != nil && page.oldest! > newest!) {
            try enqueue(page, stopAt: initialized ? newest : nil, at: 0)
        }
        try merge(page); newest = page.newest; initialized = true
    }
    mutating func earlier(_ page: RideChatDirectoryPage, cursor: String) throws {
        guard let index = cursors.firstIndex(where: { $0.token == cursor }) else { return }
        let pending = cursors[index]; try validate(page)
        if let newest = page.newest { try RideChatWire.require(newest < pending.after) }
        let reached = pending.stopAt != nil && page.oldest != nil && page.oldest! <= pending.stopAt!
        try merge(page); cursors.remove(at: index); consumed.insert(cursor)
        if !reached { try enqueue(page, stopAt: pending.stopAt, at: index) }
    }
    mutating func remove(_ reference: RideChatReference) { records = records.filter { $0.value.reference != reference } }
    private mutating func enqueue(_ page: RideChatDirectoryPage, stopAt: RideChatPosition?, at index: Int) throws {
        guard let token = page.nextCursor, let after = page.oldest else { return }
        try RideChatWire.require(!consumed.contains(token))
        if !cursors.contains(where: { $0.token == token }) {
            cursors.insert(.init(token: token, after: after, stopAt: stopAt), at: min(index, cursors.count))
        }
    }
    private func validate(_ page: RideChatDirectoryPage) throws {
        try RideChatWire.require(page.uid == uid && page.items.count + page.excluded.count <= 20 &&
            Set(page.items.map(\.id)).count == page.items.count && Set(page.excluded).count == page.excluded.count &&
            Set(page.items.map(\.id)).isDisjoint(with: page.excluded) && (page.oldest == nil) == (page.newest == nil))
        if let token = page.nextCursor { _ = try RideChatWire.cursor(token); try RideChatWire.require(page.oldest != nil) }
        if let newest = page.newest, let oldest = page.oldest { try RideChatWire.require(newest >= oldest) }
        if page.newest == nil { try RideChatWire.require(page.items.isEmpty && page.excluded.isEmpty && page.nextCursor == nil) }
        for row in page.items {
            try RideChatWire.require(row.id == row.reference.inboxId(uid: uid) && row.position.id == row.id &&
                row.revision >= 1 && row.revision <= 9_007_199_254_740_991 && row.unreadCount >= 0 && row.unreadCount <= 9_007_199_254_740_991)
            if let newest = page.newest, let oldest = page.oldest { try RideChatWire.require(row.position <= newest && row.position >= oldest) }
        }
    }
    private mutating func merge(_ page: RideChatDirectoryPage) throws {
        for id in page.excluded { records[id] = nil }
        for incoming in page.items {
            if let previous = records[incoming.id] {
                if previous.revision > incoming.revision { continue }
                if previous.revision == incoming.revision {
                    try RideChatWire.require(previous.reference == incoming.reference && previous.position == incoming.position &&
                        previous.unreadCount == incoming.unreadCount && RideChatText.same(previous.preview, incoming.preview))
                }
            }
            records[incoming.id] = incoming
        }
    }
}
