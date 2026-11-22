public struct AuthTokenResult { public var claims: [String: Any] { [:] } }
public struct User: Sendable {
    public let uid: String
    public func getIDTokenResult(forcingRefresh: Bool, completion: ((AuthTokenResult?, Error?) -> Void)?) {}
}
public struct Auth: Sendable {
    public static func auth() -> Auth { Auth() }
    public var currentUser: User? { User(uid: "isolated-concurrency-check") }
}
