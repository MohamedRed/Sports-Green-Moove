import Foundation

func checkRideChatCondition(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
    let value = try condition(); check(value, message)
}

func rideChatReject(_ label: String, _ work: () throws -> Void) {
    do { try work(); fatalError("Accepted invalid ride chat: \(label)") } catch {}
}
func checkRideChatWire() throws {
    let uid = rideChatOwner, ref = rideChatReference, null = NSNull()
    for value in ["", ".", "..", "a/b", "__reserved__", String(repeating: "a", count: 257)] {
        rideChatReject("identity \(value.prefix(8))") { _ = try RideChatID(value) }
    }
    let composed = try RideChatID("é"), decomposed = try RideChatID("e\u{301}")
    check(composed != decomposed && Set([composed, decomposed]).count == 2, "Opaque source IDs were normalized")
    check(!RideChatText.same(composed.value, decomposed.value), "Body acknowledgement erased a canonically equivalent draft")
    for value: Any in [true, 1.5, Double.infinity, -1, 9_007_199_254_740_992.0, "1", null] {
        rideChatReject("integer") { _ = try RideChatWire.integer(value) }
    }
    for value: Any in [1, "true", null] { rideChatReject("boolean") { _ = try RideChatWire.boolean(value) } }
    try checkRideChatCondition(RideChatWire.integer(9_007_199_254_740_991.0) == 9_007_199_254_740_991, "Safe integer bound changed")
    for cursor in ["", "a/b", "a=", "with space", String(repeating: "a", count: 2_049)] {
        rideChatReject("cursor") { _ = try RideChatWire.cursor(cursor) }
    }
    var access: [String: Any] = ["currentUserId": uid.value, "sourceType": "booking", "sourceId": ref.sourceId.value,
        "title": "Conversation", "participants": [["userId": uid.value, "displayName": null], ["userId": "driver", "displayName": "Conducteur"]]]
    let parsed = try RideChatWire.access(["conversation": access], uid: uid, reference: ref)
    check(parsed.participants.keys.contains(uid) && parsed.participants[uid]! == nil, "Nullable participant name removed a granted user")
    for field in ["currentUserId", "sourceType", "sourceId", "title", "participants"] {
        var invalid = access; invalid[field] = null
        rideChatReject("access \(field)") { _ = try RideChatWire.access(["conversation": invalid], uid: uid, reference: ref) }
    }
    access["participants"] = [["userId": "driver", "displayName": "Conducteur"]]
    rideChatReject("access owner missing") { _ = try RideChatWire.access(["conversation": access], uid: uid, reference: ref) }
    var message = ref.payload.merging(["participantUserIds": [uid.value, "driver"], "senderUserId": "driver", "body": "Départ confirmé."] as [String: Any]) { _, new in new }
    let position = rideChatRow(1).position
    try checkRideChatCondition(RideChatMessageWire.message(message, position: position, uid: uid, reference: ref).needsRead, "Legacy unread message without readers was lost")
    for (key, value): (String, Any) in [("sourceType", "trip"), ("sourceId", "foreign"), ("participantUserIds", ["driver"]),
        ("senderUserId", "outsider"), ("body", "  spaced  "), ("body", String(repeating: "😀", count: 501)),
        ("readByUserIds", ["outsider"]), ("readByUserIds", null), ("clientMessageId", null), ("clientMessageId", "invalid")] {
        var invalid = message; invalid[key] = value
        rideChatReject("message \(key)") { _ = try RideChatMessageWire.message(invalid, position: position, uid: uid, reference: ref) }
    }
    message["readByUserIds"] = [uid.value]
    try checkRideChatCondition(!RideChatMessageWire.message(message, position: position, uid: uid, reference: ref).needsRead, "Exact read identity ignored")
    let request = UUID(), send = try RideChatRequest.send(ref, body: "Exact message", requestId: request).payload()
    check(send["bookingId"] as? String == ref.sourceId.value && send["rideSessionId"] == nil &&
        send["clientMessageId"] as? String == request.uuidString.lowercased(), "Send intent changed source or operation")
    let requestRide = RideChatReference(kind: .rideSession, sourceId: ref.sourceId)
    try checkRideChatCondition(RideChatRequest.send(requestRide, body: "Exact", requestId: request).payload()["rideSessionId"] as? String == ref.sourceId.value, "Ride source treated as booking")
    for ids in [[], [position.id, position.id], Array(repeating: position.id, count: 51)] {
        rideChatReject("read ids") { _ = try RideChatRequest.read(ref, ids: ids).payload() }
    }
    rideChatReject("foreign send receipt") { _ = try RideChatMessageWire.sent(["messageId": "foreign", "participantUserIds": [uid.value], "reused": false], uid: uid, reference: ref, request: request) }
    rideChatReject("foreign read receipt") { _ = try RideChatMessageWire.reads(["readMessageIds": ["foreign"]], uid: uid, reference: ref, ids: [position.id]) }
    for reference in [ref, requestRide] {
        let allowed: [String: Any] = reference.kind == .booking ? ["parentUserId": uid.value, "requesterUserId": "foreign", "driverUserId": "driver"]
            : ["driverUserId": "driver", "participantUserIds": [uid.value], "childUserIds": ["child"]]
        try checkRideChatCondition(RideChatSourcePolicy.allows(allowed, uid: uid, reference: reference), "Current source rejected owner")
        try checkRideChatCondition(!RideChatSourcePolicy.allows(nil, uid: uid, reference: reference), "Deleted source retained access")
        var bad = allowed; bad["driverUserId"] = true
        rideChatReject("truthy malformed source identity") { _ = try RideChatSourcePolicy.participants(bad, reference: reference) }
    }
    try checkRideChatCondition(RideChatSourcePolicy.allows(["parentUserId": null, "requesterUserId": uid.value], uid: uid, reference: ref), "Null parent did not select requester")
    for parent: Any in [false, 0, "", "foreign"] {
        try checkRideChatCondition(!RideChatSourcePolicy.allows(["parentUserId": parent, "requesterUserId": uid.value], uid: uid, reference: ref), "Requester bypassed present parent")
    }
    rideChatReject("null ride arrays") { _ = try RideChatSourcePolicy.participants(["participantUserIds": null], reference: requestRide) }
    print("RideChatWireChecks passed: opaque byte identities, exact bodies, safe numbers, nullable names, source ownership, request/receipt correlation and source-policy parity; no SDK or phone")
}
