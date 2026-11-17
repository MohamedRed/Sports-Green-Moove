import Foundation

struct MembershipPager<Row: Identifiable & Equatable & Sendable> where Row.ID == String {
    private(set) var items: [Row] = []
    private(set) var cursor: String?
    private var consumed: Set<String> = []
    mutating func apply(_ page: MembershipPage<Row>, uid: String, requested: String?) throws {
        try MembershipWire.require(page.userId == uid && page.items.count <= 20 && Set(page.items.map(\.id)).count == page.items.count)
        for row in page.items { try MembershipWire.require(MembershipWire.id(row.id)) }
        if let requested { try MembershipWire.require(requested == cursor && !consumed.contains(requested)) }
        let previous = requested == nil ? [] : items
        try MembershipWire.require(!page.items.contains { row in previous.contains { $0.id == row.id } })
        if let next = page.cursor { try MembershipWire.require(!next.isEmpty && next.utf8.count <= 16_384 && next != requested && (requested == nil || !consumed.contains(next))) }
        if let requested { consumed.insert(requested) } else { consumed = [] }
        items = previous + page.items; cursor = page.cursor
    }
}
