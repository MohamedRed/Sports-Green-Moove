import Foundation

struct TeamChatTimeline {
    private struct Cursor { let token: String; let stopAtKnown: Bool }
    private var records: [String: TeamChatMessage] = [:]
    private var cursors: [Cursor] = []
    private var consumed: Set<String> = []
    private var head: Set<String> = []
    private var initialized = false
    var messages: [TeamChatMessage] { records.values.sorted(by: TeamChatMessage.newer) }
    var olderCursor: String? { cursors.first?.token }

    mutating func latest(_ page: TeamChatPage) throws {
        try validate(page)
        if page.nextCursor == nil {
            try merge(page.items)
            records = Dictionary(uniqueKeysWithValues: page.items.map { ($0.id, $0) })
            cursors = []; consumed = []; head = Set(page.items.map(\.id)); initialized = true; return
        }
        let ids = Set(page.items.map(\.id)), disconnected = initialized && head.isDisjoint(with: ids)
        var addition: Cursor?
        if !initialized || head.isEmpty || disconnected {
            if let token = page.nextCursor, !cursors.contains(where: { $0.token == token }) {
                try TeamChatWire.require(!consumed.contains(token))
                addition = .init(token: token, stopAtKnown: initialized && !records.isEmpty)
            }
        }
        try merge(page.items)
        if let addition { cursors.insert(addition, at: 0) }
        head = ids; initialized = true
    }
    mutating func earlier(_ page: TeamChatPage, requested: String) throws {
        try validate(page)
        guard let cursor = cursors.first, cursor.token == requested else { throw TeamChatError.invalidResponse }
        let reachesKnown = cursor.stopAtKnown && page.items.contains { records[$0.id] != nil }
        if let next = page.nextCursor {
            try TeamChatWire.require(next != requested)
            if !reachesKnown { try TeamChatWire.require(!consumed.contains(next) && !cursors.contains { $0.token == next }) }
        }
        try merge(page.items)
        consumed.insert(requested); cursors.removeFirst()
        if !reachesKnown, let next = page.nextCursor { cursors.insert(.init(token: next, stopAtKnown: cursor.stopAtKnown), at: 0) }
    }
    mutating func markRead(_ ids: Set<String>) {
        for id in ids { if var row = records[id] { row.needsRead = false; records[id] = row } }
    }
    private func validate(_ page: TeamChatPage) throws {
        try TeamChatWire.validateMessages(page.items); _ = try TeamChatWire.hash(page.accessVersion)
        if let title = page.title { try TeamChatWire.require(TeamChatWire.labelIsValid(title)) }
        if let token = page.nextCursor { _ = try TeamChatWire.cursor(token); try TeamChatWire.require(!page.items.isEmpty) }
    }
    private mutating func merge(_ rows: [TeamChatMessage]) throws {
        for row in rows {
            if let previous = records[row.id] { try TeamChatWire.require(previous.sameContent(as: row)) }
            try TeamChatWire.require(!records.values.contains { $0.id != row.id && $0.sequence == row.sequence })
        }
        for row in rows { records[row.id] = row }
    }
}
