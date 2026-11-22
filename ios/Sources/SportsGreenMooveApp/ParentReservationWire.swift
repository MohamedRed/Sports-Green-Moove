import Foundation
import CoreFoundation

enum ParentReservationWire {
    static func require(_ value: Bool) throws { if !value { throw ParentReservationError.invalidResponse } }
    static func identifier(_ value: Any?) throws -> String {
        let value = try MembershipWire.identifier(value)
        try require(value.utf16.count <= 256)
        return value
    }
    static func cursor(_ value: Any?) throws -> String? {
        let value = try MembershipWire.cursor(value)
        if let value { try require(value.utf8.count <= 2048) }
        return value
    }
    static func page(_ value: Any?, uid: String) throws -> ParentReservationPage {
        guard let data = value as? [String: Any], data.keys.contains("nextCursor"),
              let rows = data["items"] as? [[String: Any]], rows.count <= 20 else { throw ParentReservationError.invalidResponse }
        let items = try rows.map { row -> ParentReservation in
            let parent = try identifier(row["parentUserId"])
            try require(parent == uid)
            guard let rawStatus = row["status"] as? String, let status = ParentReservationStatus(rawValue: rawStatus),
                  let actions = row["allowedActions"] as? [String],
                  let count = row["seats"] as? NSNumber, CFGetTypeID(count) != CFBooleanGetTypeID() else { throw ParentReservationError.invalidResponse }
            try require(actions.isEmpty || actions == ["cancel"] && (status == .requested || status == .approved))
            let seats = count.doubleValue
            try require(seats.isFinite && seats.rounded() == seats && (1...8).contains(seats))
            try require(row.keys.contains("tripChangeId"))
            let change: String?
            if let raw = row["tripChangeId"], !(raw is NSNull) {
                guard let hash = raw as? String, hash.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw ParentReservationError.invalidResponse }
                change = hash
            } else { change = nil }
            return try .init(id: identifier(row["bookingId"]), tripId: identifier(row["tripId"]), parentUid: parent,
                childLabel: MembershipWire.text(row["childLabel"]), seats: Int(seats), status: status,
                title: MembershipWire.requiredText(row["title"]), club: MembershipWire.requiredText(row["club"]),
                date: MembershipWire.requiredText(row["dateLabel"]), time: MembershipWire.requiredText(row["timeLabel"]),
                price: MembershipWire.requiredText(row["priceLabel"]), canCancel: actions == ["cancel"],
                refundPending: MembershipWire.boolean(row["refundPending"]), tripChangeId: change)
        }
        try require(Set(items.map(\.id)).count == items.count)
        return try .init(userId: uid, items: items, cursor: cursor(data["nextCursor"]))
    }
    static func receipt(_ value: Any?, bookingId: String) throws -> ParentCancellationReceipt {
        guard let data = value as? [String: Any] else { throw ParentReservationError.invalidResponse }
        try require(try identifier(data["bookingId"]) == bookingId && data["status"] as? String == "cancelled")
        return .init(bookingId: bookingId)
    }
    static func validate(_ row: ParentReservation, uid: String) throws {
        _ = try identifier(row.id); _ = try identifier(row.tripId); _ = try identifier(row.parentUid)
        try require(row.parentUid == uid && (1...8).contains(row.seats))
        try require(!row.canCancel || row.status == .requested || row.status == .approved)
        for value in [row.title, row.club, row.date, row.time, row.price] { _ = try MembershipWire.requiredText(value) }
        _ = try MembershipWire.text(row.childLabel)
        if let hash = row.tripChangeId { try require(hash.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil) }
    }
}
