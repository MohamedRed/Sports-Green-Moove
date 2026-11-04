public struct User: Sendable { public let uid: String }
public struct Auth: Sendable {
    public static func auth() -> Auth { Auth() }
    public var currentUser: User? { User(uid: "isolated-concurrency-check") }
}
