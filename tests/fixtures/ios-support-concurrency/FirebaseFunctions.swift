// Signature-only contract fixture, not a Firebase implementation or SDK test.
public final class HTTPSCallableResult {
    public let data: Any
    public init(data: Any) { self.data = data }
}
public struct HTTPSCallable: Sendable {
    public func call(
        _ data: sending Any? = nil,
        completion: @escaping @MainActor (HTTPSCallableResult?, Error?) -> Void
    ) {}
}
public struct Functions: Sendable {
    public static func functions() -> Functions { Functions() }
    public func httpsCallable(_ name: String) -> HTTPSCallable { HTTPSCallable() }
}
