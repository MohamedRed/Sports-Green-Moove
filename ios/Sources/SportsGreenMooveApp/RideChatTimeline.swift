import Foundation

struct RideChatTimeline {
    private struct Cursor { let position: RideChatPosition; let stopAt: RideChatPosition? }
    private var records: [RideChatID: RideChatMessage] = [:]
    private var cursors: [Cursor] = []
    private var consumed = Set<RideChatPosition>()
    private var head = Set<RideChatID>()
    private var newest: RideChatPosition?
    private var initialized = false
    var messages: [RideChatMessage] { records.values.sorted { $0.position > $1.position } }
    var older: RideChatPosition? { cursors.first?.position }
    mutating func latest(_ page: RideChatPage) throws {
        try validate(page)
        let ids = Set(page.messages.map(\.id)), previous = newest
        if page.older == nil {
            try merge(page.messages)
            records = records.filter { ids.contains($0.key) }; cursors = []; consumed = []
        } else if let boundary = page.messages.last?.position {
            records = records.filter { ids.contains($0.key) || $0.value.position < boundary }
            if !initialized || head.isDisjoint(with: ids) {
                try enqueue(boundary, stopAt: initialized ? previous : nil, at: 0)
            }
            try merge(page.messages)
        }
        head = ids; newest = page.messages.first?.position; initialized = true
    }
    mutating func earlier(_ page: RideChatPage, after: RideChatPosition) throws {
        guard let cursor = cursors.first, cursor.position == after else { return }
        try validate(page)
        try RideChatWire.require(page.messages.allSatisfy { $0.position < after })
        let reached = cursor.stopAt.map { boundary in page.messages.contains { $0.position <= boundary } } ?? false
        try merge(page.messages); cursors.removeFirst(); consumed.insert(after)
        if !reached, let next = page.older { try enqueue(next, stopAt: cursor.stopAt, at: 0) }
    }
    mutating func markRead(_ ids: Set<RideChatID>) {
        for id in ids { if var row = records[id] { row.needsRead = false; records[id] = row } }
    }
    private mutating func enqueue(_ position: RideChatPosition, stopAt: RideChatPosition?, at index: Int) throws {
        try RideChatWire.require(!consumed.contains(position))
        if !cursors.contains(where: { $0.position == position }) { cursors.insert(.init(position: position, stopAt: stopAt), at: index) }
    }
    private func validate(_ page: RideChatPage) throws {
        try RideChatWire.require(page.messages.count <= 50 && Set(page.messages.map(\.id)).count == page.messages.count)
        for row in page.messages {
            try RideChatWire.require(row.position.id == row.id && RideChatText.valid(row.body) &&
                RideChatText.same(row.body, RideChatText.normalized(row.body)) && (row.sender != page.uid || !row.needsRead))
        }
        for pair in zip(page.messages, page.messages.dropFirst()) { try RideChatWire.require(pair.0.position > pair.1.position) }
        if let older = page.older { try RideChatWire.require(page.messages.count == 50 && page.messages.last?.position == older) }
    }
    private mutating func merge(_ rows: [RideChatMessage]) throws {
        for var row in rows {
            if let previous = records[row.id] {
                try RideChatWire.require(previous.sameContent(row))
                if !previous.needsRead { row.needsRead = false }
            }
            records[row.id] = row
        }
    }
}
