import Foundation

enum RideChatDirectoryWire {
    private static func rows(_ data: [String: Any]) throws -> [[String: Any]] {
        guard let rows = data["items"] as? [[String: Any]], rows.count <= 20 else { throw RideChatError.invalidResponse }; return rows
    }
    private static func context(_ data: [String: Any]) throws -> RideChatContext {
        try .init(title: RideChatWire.text(data["title"]), departureLabel: RideChatWire.text(data["departureLabel"]),
            peerLabel: RideChatWire.nullableText(data, "peerLabel"), childLabel: RideChatWire.nullableText(data, "childLabel"))
    }
    private static func boundary(_ data: [String: Any], _ key: String) throws -> RideChatPosition? {
        try RideChatWire.require(data.keys.contains(key)); if data[key] is NSNull { return nil }
        let value = try RideChatWire.object(data[key])
        return try RideChatWire.position(value, seconds: "seconds", nanos: "nanos", id: RideChatWire.hash(value["id"]))
    }
    static func directory(_ raw: Any?, uid: RideChatID) throws -> RideChatDirectoryPage {
        let data = try RideChatWire.object(raw)
        let items = try rows(data).map { row -> RideChatDirectoryRow in
            let id = try RideChatWire.hash(row["id"]), reference = try RideChatWire.reference(row)
            try RideChatWire.require(id == reference.inboxId(uid: uid))
            return try .init(id: id, reference: reference, context: context(row), preview: RideChatWire.text(row["preview"], maximum: 1_000),
                dateLabel: RideChatWire.text(row["dateLabel"]), unreadCount: RideChatWire.integer(row["unreadCount"]),
                revision: RideChatWire.integer(row["revision"], minimum: 1),
                position: RideChatWire.position(row, seconds: "lastMessageSeconds", nanos: "lastMessageNanos", id: id))
        }
        let excluded = try RideChatWire.ids(data["excludedIds"], maximum: 20)
        for id in excluded { _ = try RideChatWire.hash(id.value) }
        try RideChatWire.require(items.count + excluded.count <= 20 && Set(items.map(\.id)).count == items.count &&
            Set(items.map(\.reference)).count == items.count && Set(items.map(\.id)).isDisjoint(with: excluded))
        let newest = try boundary(data, "newest"), oldest = try boundary(data, "oldest"), cursor = try RideChatWire.nextCursor(data)
        try RideChatWire.require((newest == nil) == (oldest == nil))
        if let newest, let oldest {
            try RideChatWire.require(newest >= oldest && items.count + excluded.count > 0)
            try RideChatWire.require(items.allSatisfy { $0.position <= newest && $0.position >= oldest })
        } else { try RideChatWire.require(items.isEmpty && excluded.isEmpty && cursor == nil) }
        for pair in zip(items, items.dropFirst()) { try RideChatWire.require(pair.0.position > pair.1.position) }
        return .init(uid: uid, items: items, excluded: excluded, newest: newest, oldest: oldest, nextCursor: cursor)
    }
    static func bookings(_ raw: Any?, uid: RideChatID) throws -> RideChatBookingPage {
        let data = try RideChatWire.object(raw)
        let items = try rows(data).map { row -> RideChatBooking in
            let reference = try RideChatWire.reference(row)
            guard reference.kind == .booking, let raw = row["bookingStatus"] as? String,
                  let status = RideChatBooking.Status(rawValue: raw) else { throw RideChatError.invalidResponse }
            return try .init(reference: reference, context: context(row), status: status)
        }
        try RideChatWire.require(Set(items.map(\.id)).count == items.count)
        return try .init(uid: uid, items: items, nextCursor: RideChatWire.nextCursor(data))
    }
}
