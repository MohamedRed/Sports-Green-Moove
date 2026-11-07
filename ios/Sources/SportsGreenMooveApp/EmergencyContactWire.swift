import Foundation
import CoreFoundation

enum EmergencyContactWire {
    static let maximumRevision: Int64 = 9_007_199_254_740_991
    static func require(_ value: Bool) throws { if !value { throw EmergencyContactError.invalidResponse } }
    static func validText(_ value: String, maximum: Int) -> Bool {
        !value.isEmpty && value == value.trimmingCharacters(in: .whitespacesAndNewlines) &&
        value.utf16.count <= maximum && value.range(of: #"[\x{0000}-\x{001f}\x{007f}-\x{009f}\x{202a}-\x{202e}\x{2066}-\x{2069}]"#,
            options: .regularExpression) == nil
    }
    static func validId(_ value: String) -> Bool {
        validText(value, maximum: 256) && !value.contains("/") && value != "." && value != ".." &&
        !(value.hasPrefix("__") && value.hasSuffix("__"))
    }
    static func instance(_ value: Any?) throws -> String {
        guard let value = value as? String, value.utf16.count == 64, value.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else {
            throw EmergencyContactError.invalidResponse
        }
        return value
    }
    static func revision(_ value: Any?) throws -> Int64 {
        guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { throw EmergencyContactError.invalidResponse }
        let d = n.doubleValue
        try require(d.isFinite && d.rounded() == d && d >= 0 && d <= Double(maximumRevision))
        return Int64(d)
    }
    static func targetPayload(_ target: EmergencyContactTarget) throws -> [String: String] {
        switch target {
        case .personal: return ["kind": "self"]
        case let .child(childId, clubId):
            try require(validId(childId) && validId(clubId))
            return ["kind": "child", "childId": childId, "clubId": clubId]
        }
    }
    static func view(_ raw: Any?, uid: String, scope: EmergencyContactScope) throws -> EmergencyContactView? {
        guard let data = raw as? [String: Any] else { throw EmergencyContactError.invalidResponse }
        if scope == .childRide(nil) {
            try require(data["accountUserId"] as? String == uid && data.keys.contains("current"))
            if data["current"] is NSNull { return nil }
            guard let current = data["current"] as? [String: Any], let id = current["rideSessionId"] as? String else {
                throw EmergencyContactError.invalidResponse
            }
            return try view(current, uid: uid, scope: .childRide(id))
        }
        try require(validId(uid) && data.keys.contains("contact"))
        let version = try revision(data["revision"])
        var contact: PersonalEmergencyContact?
        if !(data["contact"] is NSNull) {
            guard let fields = data["contact"] as? [String: Any], Set(fields.keys) == ["name", "phone"],
                  let name = fields["name"] as? String, let phone = fields["phone"] as? String else {
                throw EmergencyContactError.invalidResponse
            }
            contact = PersonalEmergencyContact(name: name, phone: phone)
            try require(contact?.isValid == true && version > 0)
        }
        var result = EmergencyContactView(ownerUid: uid, scope: scope, contact: contact, revision: version)
        switch scope {
        case .managed(.personal):
            try require(data["kind"] as? String == "self" && data["subjectId"] as? String == uid)
            try require(["childInstanceId", "clubId", "childName", "clubName"].allSatisfy { !data.keys.contains($0) })
        case let .managed(.child(childId, clubId)):
            try require(validId(childId) && validId(clubId) && data["kind"] as? String == "child" &&
                data["subjectId"] as? String == childId && data["clubId"] as? String == clubId)
            result.childId = childId; result.childInstanceId = try instance(data["childInstanceId"])
            result.childName = try label(data["childName"]); result.clubName = try label(data["clubName"])
        case let .childRide(id):
            guard let id, let childId = data["subjectId"] as? String else { throw EmergencyContactError.invalidResponse }
            try require(validId(id) && validId(childId) && data["accountUserId"] as? String == uid && data["rideSessionId"] as? String == id)
            result.childId = childId; result.childInstanceId = try instance(data["childInstanceId"])
            result.childName = try label(data["childName"])
        }
        return result
    }
    static func validate(_ view: EmergencyContactView, uid: String, scope: EmergencyContactScope) throws {
        try require(view.ownerUid == uid && validId(uid) && view.revision >= 0 && view.revision <= maximumRevision)
        try require(view.contact == nil || (view.contact?.isValid == true && view.revision > 0))
        if scope == .childRide(nil) {
            guard case let .childRide(id) = view.scope, let id else { throw EmergencyContactError.invalidResponse }
            try require(validId(id))
        } else { try require(view.scope == scope) }
        switch view.scope {
        case .managed(.personal):
            try require(view.childId == nil && view.childInstanceId == nil && view.childName == nil && view.clubName == nil)
        case let .managed(.child(childId, clubId)):
            try require(validId(childId) && validId(clubId) && view.childId == childId)
            _ = try instance(view.childInstanceId); _ = try label(view.childName); _ = try label(view.clubName)
        case let .childRide(id):
            try require(id.map(validId) == true && view.childId.map(validId) == true && view.clubName == nil)
            _ = try instance(view.childInstanceId); _ = try label(view.childName)
        }
    }
    static func payload(_ operation: EmergencyContactOperation) throws -> [String: Any] {
        try require(operation.expectedRevision >= 0 && operation.expectedRevision < maximumRevision &&
            (operation.contact == nil || operation.contact?.isValid == true))
        var result: [String: Any] = ["target": try targetPayload(operation.target), "expectedRevision": operation.expectedRevision,
            "requestId": operation.requestId.uuidString.lowercased(), "contact": NSNull()]
        if let contact = operation.contact { result["contact"] = ["name": contact.name, "phone": contact.phone] }
        if case .child = operation.target { result["expectedChildInstanceId"] = try instance(operation.expectedChildInstanceId) }
        else { try require(operation.expectedChildInstanceId == nil) }
        return result
    }
    static func receipt(_ raw: Any?, uid: String, operation: EmergencyContactOperation) throws -> Int64 {
        guard let data = raw as? [String: Any], let flag = data["replayed"] as? NSNumber,
              CFGetTypeID(flag) == CFBooleanGetTypeID() else { throw EmergencyContactError.invalidResponse }
        let revision = try revision(data["revision"])
        try require(revision > operation.expectedRevision)
        switch operation.target {
        case .personal:
            try require(data["kind"] as? String == "self" && data["subjectId"] as? String == uid)
            try require(["childInstanceId", "clubId", "childName", "clubName"].allSatisfy { !data.keys.contains($0) })
        case let .child(childId, clubId):
            try require(data["kind"] as? String == "child" && data["subjectId"] as? String == childId && data["clubId"] as? String == clubId)
            try require(try instance(data["childInstanceId"]) == instance(operation.expectedChildInstanceId))
        }
        return revision
    }
    private static func label(_ value: Any?) throws -> String {
        guard let value = value as? String, validText(value, maximum: 120) else { throw EmergencyContactError.invalidResponse }
        return value
    }
}
