import Foundation

func checkRideChatDirectoryWire() throws {
    let uid = rideChatOwner, ref = rideChatReference, id = try ref.inboxId(uid: uid), null = NSNull()
    let context: [String: Any] = ["title": "Entraînement", "departureLabel": "30 novembre", "peerLabel": null, "childLabel": null]
    let row = ref.payload.merging(context) { _, new in new }.merging(["id": id.value, "preview": "Départ confirmé.",
        "dateLabel": "Aujourd’hui", "unreadCount": 2, "revision": 1, "lastMessageSeconds": 100, "lastMessageNanos": 0]) { _, new in new }
    let boundary: [String: Any] = ["seconds": 100, "nanos": 0, "id": id.value]
    let payload: [String: Any] = ["items": [row], "excludedIds": [], "newest": boundary, "oldest": boundary, "nextCursor": null]
    let parsed = try RideChatDirectoryWire.directory(payload, uid: uid)
    check(parsed.items.count == 1 && parsed.items[0].context.peerLabel == nil && parsed.items[0].unreadCount == 2,
        "Directory lost nullable display fields or exact counter")
    for (key, value): (String, Any) in [("id", String(repeating: "a", count: 64)), ("sourceType", "trip"), ("sourceId", "foreign"),
        ("title", ""), ("departureLabel", null), ("peerLabel", 0), ("childLabel", false), ("preview", "  altered  "),
        ("unreadCount", true), ("unreadCount", -1), ("revision", 0), ("lastMessageSeconds", 253_402_300_800.0), ("lastMessageNanos", 1_000_000_000)] {
        var invalidRow = row; invalidRow[key] = value
        var invalid = payload; invalid["items"] = [invalidRow]
        rideChatReject("directory row \(key)") { _ = try RideChatDirectoryWire.directory(invalid, uid: uid) }
    }
    for key in ["nextCursor", "oldest", "newest", "excludedIds"] {
        var missing = payload; missing.removeValue(forKey: key)
        rideChatReject("missing directory \(key)") { _ = try RideChatDirectoryWire.directory(missing, uid: uid) }
    }
    var duplicate = payload; duplicate["items"] = [row, row]
    rideChatReject("duplicate directory") { _ = try RideChatDirectoryWire.directory(duplicate, uid: uid) }
    var overlap = payload; overlap["excludedIds"] = [id.value]
    rideChatReject("included/excluded overlap") { _ = try RideChatDirectoryWire.directory(overlap, uid: uid) }
    var foreign = payload; foreign["oldest"] = ["seconds": 101, "nanos": 0, "id": id.value]
    rideChatReject("reversed scanned boundaries") { _ = try RideChatDirectoryWire.directory(foreign, uid: uid) }
    var booking = ref.payload.merging(context) { _, new in new }; booking["bookingStatus"] = "approved"
    try checkRideChatCondition(RideChatDirectoryWire.bookings(["items": [booking], "nextCursor": null], uid: uid).items[0].reference == ref,
        "Booking choice changed exact source")
    for (key, value): (String, Any) in [("sourceType", "rideSession"), ("bookingStatus", "unknown"), ("bookingStatus", null)] {
        var invalid = booking; invalid[key] = value
        rideChatReject("booking \(key)") { _ = try RideChatDirectoryWire.bookings(["items": [invalid], "nextCursor": null], uid: uid) }
    }
    let empty = try RideChatDirectoryWire.bookings(["items": [], "nextCursor": "scanned-next"], uid: uid)
    check(empty.items.isEmpty && empty.nextCursor != nil, "Empty scanned page suppressed booking continuation")
    print("RideChatDirectoryWireChecks passed: 23 malformed directory/booking groups, exact owner-derived indexes, nullable metadata and empty scanned continuation")
}
