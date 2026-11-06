import Foundation
import CoreFoundation

enum ChildAccountWire {
    static func require(_ condition: Bool) throws { if !condition { throw ChildAccountError.invalidResponse } }
    static func hex(_ value: String, count: Int) -> Bool {
        value.utf8.count == count && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }
    static func target(_ value: ChildAccountTarget) throws -> [String: String] {
        try require(EmergencyContactWire.validId(value.childId) && EmergencyContactWire.validId(value.clubId) &&
            hex(value.childInstanceId, count: 64) && EmergencyContactWire.validText(value.childName, maximum: 120))
        return ["childId": value.childId, "clubId": value.clubId, "expectedChildInstanceId": value.childInstanceId]
    }
    static func expiry(_ raw: Any?) throws -> Int64 {
        let value = try EmergencyContactWire.revision(raw); try require(value > 0); return value
    }
    static func code(_ raw: Any?, uid: String) throws -> ChildAccountCode {
        guard let row = raw as? [String: Any], let code = row["code"] as? String else { throw ChildAccountError.invalidResponse }
        try require(EmergencyContactWire.validId(uid) && row["accountUserId"] as? String == uid && hex(code, count: 32))
        return ChildAccountCode(accountUserId: uid, code: code, expiresAtMillis: try expiry(row["expiresAtMillis"]))
    }
    static func receipt(_ raw: Any?, uid: String, target: ChildAccountTarget) throws -> ChildAccountReceipt {
        guard let row = raw as? [String: Any], let account = row["accountUserId"] as? String,
              let flag = row["replayed"] as? NSNumber, CFGetTypeID(flag) == CFBooleanGetTypeID() else {
            throw ChildAccountError.invalidResponse
        }
        _ = try self.target(target)
        try require(EmergencyContactWire.validId(account) && account != uid && row["childId"] as? String == target.childId &&
            row["childInstanceId"] as? String == target.childInstanceId)
        return ChildAccountReceipt(accountUserId: account, childId: target.childId, childInstanceId: target.childInstanceId, replayed: flag.boolValue)
    }
    static func summary(_ raw: Any?) throws -> ChildInvitationSummary {
        guard let row = raw as? [String: Any], let hash = row["invitationHash"] as? String,
              let value = row["status"] as? String, let status = ChildInvitationStatus(rawValue: value) else {
            throw ChildAccountError.invalidResponse
        }
        try require(hex(hash, count: 64))
        return ChildInvitationSummary(invitationHash: hash, status: status, expiresAtMillis: try expiry(row["expiresAtMillis"]))
    }
    static func current(_ raw: Any?) throws -> ChildInvitationSummary? {
        guard let row = raw as? [String: Any], row.keys.contains("current") else { throw ChildAccountError.invalidResponse }
        return row["current"] is NSNull ? nil : try summary(row["current"])
    }
    static func revocation(_ raw: Any?, hash: String) throws {
        guard let row = raw as? [String: Any], let flag = row["revoked"] as? NSNumber,
              CFGetTypeID(flag) == CFBooleanGetTypeID() else { throw ChildAccountError.invalidResponse }
        try require(flag.boolValue && row["invitationHash"] as? String == hash && hex(hash, count: 64))
    }
}
