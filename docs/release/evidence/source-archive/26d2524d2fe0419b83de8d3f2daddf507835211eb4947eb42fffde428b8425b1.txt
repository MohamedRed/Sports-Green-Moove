import Foundation
import CoreFoundation

struct ProfileCity: Equatable, Sendable {
    let userId: String
    let city: String?
    let revision: Int64
    func validate(uid: String) throws {
        try ProfileCityWire.require(!uid.isEmpty && userId == uid && (0...ProfileCityWire.maximumRevision).contains(revision))
        if let city { try ProfileCityWire.require(revision > 0 && ProfileCityWire.canonical(city)) }
    }
}
struct ProfileCityChange: Equatable, Sendable {
    let city: String?
    let expectedRevision: Int64
    let requestId: UUID
    func validate() throws {
        try ProfileCityWire.require((0..<ProfileCityWire.maximumRevision).contains(expectedRevision))
        if let city { try ProfileCityWire.require(ProfileCityWire.canonical(city)) }
    }
}
protocol ProfileCityGateway: Sendable {
    func profileCity(uid: String) async throws -> ProfileCity
    func saveProfileCity(uid: String, change: ProfileCityChange) async throws -> ProfileCity
}
enum ProfileCityError: Error { case invalidResponse }
enum ProfileCityWire {
    static let maximumRevision: Int64 = 9_007_199_254_740_991
    static func require(_ condition: Bool) throws { if !condition { throw ProfileCityError.invalidResponse } }
    static func normalized(_ value: String) -> String? {
        guard value.utf16.count <= 100,
              value.range(of: #"[\x{0000}-\x{001f}\x{007f}-\x{009f}\x{200b}-\x{200f}\x{2028}-\x{202e}\x{2060}-\x{206f}\x{feff}]"#,
                options: .regularExpression) == nil else { return nil }
        let text = value.trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping
        return !text.isEmpty && text.utf16.count <= 100 ? text : nil
    }
    static func canonical(_ value: String) -> Bool {
        guard let normalized = normalized(value) else { return false }
        return normalized.utf16.elementsEqual(value.utf16)
    }
    static func parse(_ raw: Any?, uid: String) throws -> ProfileCity {
        guard let data = raw as? [String: Any], Set(data.keys) == ["userId", "city", "revision"],
              let userId = data["userId"] as? String, let revision = data["revision"] as? NSNumber,
              CFGetTypeID(revision) != CFBooleanGetTypeID() else { throw ProfileCityError.invalidResponse }
        let number = revision.doubleValue
        try require(number.isFinite && number >= 0 && number <= Double(maximumRevision) && number.rounded() == number)
        let city: String?
        if data["city"] is NSNull { city = nil }
        else { guard let text = data["city"] as? String else { throw ProfileCityError.invalidResponse }; city = text }
        let result = ProfileCity(userId: userId, city: city, revision: Int64(number))
        try result.validate(uid: uid); return result
    }
}
enum ProfileCityRequest: Sendable {
    case read
    case save(ProfileCityChange)
    var name: String { switch self { case .read: "getProfileCity"; case .save: "saveProfileCity" } }
    func payload() throws -> [String: Any] {
        switch self {
        case .read: return [:]
        case let .save(change):
            try change.validate()
            return ["city": change.city.map { $0 as Any } ?? NSNull(), "expectedRevision": change.expectedRevision,
                "requestId": change.requestId.uuidString.lowercased()]
        }
    }
}
