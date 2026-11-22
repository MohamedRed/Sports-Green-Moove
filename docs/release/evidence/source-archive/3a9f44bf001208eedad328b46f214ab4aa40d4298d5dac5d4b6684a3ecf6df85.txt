import Foundation

func checkEmergencyContactWire() throws {
    var rejected = 0
    func rejects(_ block: () throws -> Void) {
        do { try block(); fatalError("Malformed contact protocol was accepted") }
        catch { rejected += 1 }
    }
    let raw: [String: Any] = ["kind": "self", "subjectId": "isolated-parent", "contact": NSNull(), "revision": 0]
    let empty = try EmergencyContactWire.view(raw, uid: "isolated-parent", scope: .managed(.personal))
    check(empty?.contact == nil && empty?.revision == 0, "Explicitly absent personal contact was not read")
    let invalidRevisions: [Any] = [true, -1, 0.25, Double.infinity, Double.nan, "1", 9_007_199_254_740_992.0]
    for invalid in invalidRevisions {
        rejects { _ = try EmergencyContactWire.view(raw.merging(["revision": invalid]) { _, new in new }, uid: "isolated-parent", scope: .managed(.personal)) }
    }
    for phone in ["0470000000", "+32470000001\n", "+32470000001;123", "tel:+32470000001", "+012345678", "+1234567", "+" + String(repeating: "1", count: 16)] {
        check(!PersonalEmergencyContact(name: "Contact", phone: phone).isValid, "Unsafe phone destination accepted")
    }
    for name in ["", " Contact", "Contact\n", "\u{202e}Contact", String(repeating: "x", count: 101)] {
        check(!PersonalEmergencyContact(name: name, phone: isolatedContact.phone).isValid, "Invalid private contact label accepted")
    }
    let invalidPersonal: [[String: Any]] = [["subjectId": "other"], ["kind": "child"], ["clubId": "club"], ["contact": [:]],
        ["contact": ["name": "Contact", "phone": isolatedContact.phone, "extra": true]]]
    for changes in invalidPersonal {
        rejects { _ = try EmergencyContactWire.view(raw.merging(changes) { _, new in new }, uid: "isolated-parent", scope: .managed(.personal)) }
    }
    var missing = raw; missing.removeValue(forKey: "contact")
    rejects { _ = try EmergencyContactWire.view(missing, uid: "isolated-parent", scope: .managed(.personal)) }
    let child: [String: Any] = ["kind": "child", "subjectId": "profile-child", "clubId": "club", "childName": "Enfant fictif",
        "clubName": "Club fictif", "childInstanceId": String(repeating: "a", count: 64), "contact": NSNull(), "revision": 0]
    let childScope = EmergencyContactScope.managed(.child(childId: "profile-child", clubId: "club"))
    let childView = try EmergencyContactWire.view(child, uid: "isolated-parent", scope: childScope)!
    try EmergencyContactWire.validate(childView, uid: "isolated-parent", scope: childScope)
    let invalidChildren: [[String: Any]] = [["childInstanceId": "old"], ["childInstanceId": String(repeating: "a", count: 64) + "\n"], ["clubId": "other"], ["childName": ""]]
    for changes in invalidChildren {
        rejects { _ = try EmergencyContactWire.view(child.merging(changes) { _, new in new }, uid: "isolated-parent", scope: childScope) }
    }
    let absent = try EmergencyContactWire.view(["accountUserId": "child-login", "current": NSNull()], uid: "child-login", scope: .childRide(nil))
    check(absent == nil, "No active child ride must remain explicit absence")
    rejects { _ = try EmergencyContactWire.view(["accountUserId": "other", "current": NSNull()], uid: "child-login", scope: .childRide(nil)) }
    let operation = EmergencyContactOperation(target: .personal, contact: isolatedContact, expectedRevision: 0, requestId: UUID(), expectedChildInstanceId: nil)
    let payload = try EmergencyContactWire.payload(operation)
    check((payload["contact"] as? [String: String])?["phone"] == isolatedContact.phone, "Saved contact changed its destination")
    let receipt: [String: Any] = ["kind": "self", "subjectId": "isolated-parent", "revision": 1, "replayed": false]
    let version = try EmergencyContactWire.receipt(receipt, uid: "isolated-parent", operation: operation)
    check(version == 1, "Current write receipt rejected")
    let invalidReceipts: [[String: Any]] = [["subjectId": "other"], ["revision": 0], ["replayed": 1], ["childInstanceId": String(repeating: "a", count: 64)]]
    for changes in invalidReceipts {
        rejects { _ = try EmergencyContactWire.receipt(receipt.merging(changes) { _, new in new }, uid: "isolated-parent", operation: operation) }
    }
    print("EmergencyContactWireChecks passed: \(rejected) malformed wire cases rejected; strict phone/name and immutable child identity checks")
}
