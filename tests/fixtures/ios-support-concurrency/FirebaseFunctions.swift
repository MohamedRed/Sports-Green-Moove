// Signature-only contract fixture, not a Firebase implementation or SDK test.
public let FunctionsErrorDomain = "isolated-signature-domain"
public enum FunctionsErrorCode: Int {
    case invalidArgument = 3, notFound = 5, alreadyExists = 6, permissionDenied = 7, resourceExhausted = 8
    case failedPrecondition = 9, aborted = 10, unauthenticated = 16
}
public final class HTTPSCallableResult {
    public let data: Any
    public init(data: Any) { self.data = data }
}
public final class HTTPSCallable: Sendable {
    public func call(
        _ data: sending Any? = nil,
        completion: @escaping @MainActor (HTTPSCallableResult?, Error?) -> Void
    ) {}
}
public final class Functions: Sendable {
    public static func functions() -> Functions { Functions() }
    public func httpsCallable(_ name: String) -> HTTPSCallable { HTTPSCallable() }
}
