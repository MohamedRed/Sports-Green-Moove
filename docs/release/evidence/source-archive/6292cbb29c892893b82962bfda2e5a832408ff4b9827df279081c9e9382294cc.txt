import Foundation

enum InitializedProfileError: Error { case invalid }

private func validRoles(_ roles: [AppRole]) -> Bool {
    !roles.isEmpty && Set(roles).count == roles.count && (!roles.contains(.child) || roles == [.child])
}

struct AuthIdentity: Hashable, Sendable {
    let uid: String
    let email: String?
}

struct AuthSession: Hashable, Sendable {
    let uid: String
    let email: String?
    let displayName: String?
    let roles: [AppRole]

    var isValid: Bool {
        !uid.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && validRoles(roles)
    }

    var initials: String? {
        guard let displayName, !displayName.isEmpty else { return nil }
        let letters = displayName.split(whereSeparator: \.isWhitespace).prefix(2).compactMap(\.first)
        return letters.isEmpty ? nil : String(letters).uppercased()
    }
}

protocol InitializedProfileGateway: Sendable {
    func initializeProfile(identity: AuthIdentity, displayName: String?) async throws -> AuthSession
}

enum InitializedProfileWire {
    private struct Payload: Decodable {
        let userId: String
        let email: String?
        let displayName: String?
        let roles: [String: Bool]
        let roleKeys: [AppRole]
    }

    static func session(expectedUid: String, payload: Any?) throws -> AuthSession {
        guard let payload, JSONSerialization.isValidJSONObject(payload) else { throw InitializedProfileError.invalid }
        let data = try JSONSerialization.data(withJSONObject: payload)
        let decoded = try JSONDecoder().decode(Payload.self, from: data)
        let session = AuthSession(uid: decoded.userId, email: decoded.email,
            displayName: decoded.displayName?.trimmingCharacters(in: .whitespacesAndNewlines), roles: decoded.roleKeys)
        guard session.isValid, session.uid == expectedUid,
              Set(decoded.roles.keys) == Set(AppRole.allCases.map(\.rawValue)),
              AppRole.allCases.allSatisfy({ decoded.roles[$0.rawValue] == session.roles.contains($0) }) else {
            throw InitializedProfileError.invalid
        }
        return session
    }

    static func roleKeys(_ value: Any?) throws -> [AppRole] {
        guard let value, JSONSerialization.isValidJSONObject(value) else { throw InitializedProfileError.invalid }
        let roles = try JSONDecoder().decode([AppRole].self, from: JSONSerialization.data(withJSONObject: value))
        guard validRoles(roles) else { throw InitializedProfileError.invalid }
        return roles
    }
}
