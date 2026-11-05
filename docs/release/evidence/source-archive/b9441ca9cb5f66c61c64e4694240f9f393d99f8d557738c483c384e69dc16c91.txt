import Foundation

#if DEBUG
private actor UITestProfileCity {
    static let shared = UITestProfileCity()
    private var value = ProfileCity(userId: "ui-user", city: nil, revision: 0)
    private var last: ProfileCityChange?
    func read(uid: String) throws -> ProfileCity {
        guard uid == "ui-user" else { throw CancellationError() }; return value
    }
    func save(uid: String, change: ProfileCityChange) throws -> ProfileCity {
        guard uid == "ui-user" else { throw CancellationError() }
        try change.validate()
        if change == last { return value }
        try ProfileCityWire.require(change.expectedRevision == value.revision)
        last = change; value = .init(userId: uid, city: change.city, revision: change.expectedRevision + 1)
        return value
    }
}
extension UITestFirebaseGateway {
    func profileCity(uid: String) async throws -> ProfileCity { try await UITestProfileCity.shared.read(uid: uid) }
    func saveProfileCity(uid: String, change: ProfileCityChange) async throws -> ProfileCity {
        try await UITestProfileCity.shared.save(uid: uid, change: change)
    }
}
#endif
