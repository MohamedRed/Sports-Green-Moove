import Foundation

enum EmergencyContactRequest: Sendable {
    case guardianContacts(cursor: String?)
    case read(EmergencyContactScope)
    case save(EmergencyContactOperation)

    var name: String {
        switch self {
        case .guardianContacts: return "listMyGuardianVerifications"
        case .read(.managed): return "getEmergencyContact"
        case .read(.childRide(nil)): return "getCurrentChildRideEmergencyContact"
        case .read(.childRide(.some)): return "getChildRideEmergencyContact"
        case .save: return "saveEmergencyContact"
        }
    }

    func payload() throws -> [String: Any] {
        switch self {
        case let .guardianContacts(cursor):
            try EmergencyContactWire.require(GuardianContactWire.validCursor(cursor))
            return cursor.map { ["cursor": $0] } ?? [:]
        case let .read(.managed(target)):
            return ["target": try EmergencyContactWire.targetPayload(target)]
        case .read(.childRide(nil)): return [:]
        case let .read(.childRide(id?)):
            try EmergencyContactWire.require(EmergencyContactWire.validId(id))
            return ["rideSessionId": id]
        case let .save(operation): return try EmergencyContactWire.payload(operation)
        }
    }
}
