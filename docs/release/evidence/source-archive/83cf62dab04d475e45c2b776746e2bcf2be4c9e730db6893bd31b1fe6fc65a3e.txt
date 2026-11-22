import Foundation

private func requireContactSendable<T: Sendable>(_ value: T) {}

func checkEmergencyContactRequests() throws {
    let requestId = UUID(uuidString: "00000000-0000-4000-8000-000000000001")!
    let instance = String(repeating: "a", count: 64)
    let child = EmergencyContactTarget.child(childId: "child", clubId: "club")
    let contact = PersonalEmergencyContact(name: "Synthetic contact", phone: "+32470000000")
    let readCases: [(EmergencyContactRequest, String, [String: Any])] = [
        (.guardianContacts(cursor: nil), "listMyGuardianVerifications", [:]),
        (.guardianContacts(cursor: "next_page-1"), "listMyGuardianVerifications", ["cursor": "next_page-1"]),
        (.read(.managed(.personal)), "getEmergencyContact", ["target": ["kind": "self"]]),
        (.read(.managed(child)), "getEmergencyContact", ["target": ["kind": "child", "childId": "child", "clubId": "club"]]),
        (.read(.childRide(nil)), "getCurrentChildRideEmergencyContact", [:]),
        (.read(.childRide("ride")), "getChildRideEmergencyContact", ["rideSessionId": "ride"]),
    ]
    for (request, name, payload) in readCases {
        requireContactSendable(request)
        check(request.name == name, "Contact request selected another callable")
        let first = try request.payload(), second = try request.payload()
        check(NSDictionary(dictionary: first).isEqual(to: payload) && NSDictionary(dictionary: second).isEqual(to: payload),
            "Contact request changed or retained its payload")
    }
    for target in [EmergencyContactTarget.personal, child] {
        for removing in [false, true] {
            let operation = EmergencyContactOperation(target: target, contact: removing ? nil : contact,
                expectedRevision: 3, requestId: requestId, expectedChildInstanceId: target == .personal ? nil : instance)
            let request = EmergencyContactRequest.save(operation)
            requireContactSendable(request)
            check(request.name == "saveEmergencyContact", "Contact save selected another callable")
            let payload = try request.payload()
            let expected = try EmergencyContactWire.payload(operation)
            check(NSDictionary(dictionary: payload).isEqual(to: expected), "Contact save lost immutable fields")
            check(payload["expectedRevision"] as? Int64 == 3 && payload["requestId"] as? String == requestId.uuidString.lowercased(),
                "Contact save changed revision or operation identity")
            check(removing ? payload["contact"] is NSNull : (payload["contact"] as? [String: String])?["phone"] == contact.phone,
                "Contact save changed removal or phone semantics")
        }
    }
    var rejected = 0
    let invalid: [EmergencyContactRequest] = [
        .guardianContacts(cursor: ""), .guardianContacts(cursor: "bad cursor"), .guardianContacts(cursor: String(repeating: "a", count: 16_385)),
        .read(.childRide("bad/ride")), .read(.childRide("")),
        .read(.managed(.child(childId: "bad/child", clubId: "club"))),
        .read(.managed(.child(childId: "child", clubId: "bad/club"))),
        .save(.init(target: child, contact: contact, expectedRevision: 3, requestId: requestId, expectedChildInstanceId: nil)),
        .save(.init(target: .personal, contact: contact, expectedRevision: -1, requestId: requestId, expectedChildInstanceId: nil)),
        .save(.init(target: .personal, contact: .init(name: "Invalid", phone: "000"), expectedRevision: 3,
            requestId: requestId, expectedChildInstanceId: nil)),
    ]
    for request in invalid {
        do { _ = try request.payload(); fatalError("Invalid typed contact request was accepted") }
        catch { rejected += 1 }
    }
    check(rejected == 10, "Contact request rejection inventory changed")
    print("EmergencyContactRequestChecks passed: 10 exact request variants and 10 invalid inputs; Sendable request values, fresh payloads, immutable save/removal identity; no SDK or device request")
}
