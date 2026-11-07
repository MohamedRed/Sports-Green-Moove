import Foundation

public let FunctionsErrorDomain = "FIRFunctionsErrorDomain"
public enum FunctionsErrorCode: Int { case aborted = 10 }

// Scripted results contain an immutable JSON value, never a mutable SDK payload.
public final class HTTPSCallableResult: @unchecked Sendable {
    public let data: Any
    init(_ bytes: Data) throws { data = try JSONSerialization.jsonObject(with: bytes) }
}
public final class Functions: Sendable {
    public static func functions() -> Functions { Functions() }
    public func httpsCallable(_ name: String) -> HTTPSCallable { HTTPSCallable(name) }
}
public final class HTTPSCallable: Sendable {
    private let name: String
    init(_ name: String) { self.name = name }
    public func call(_ input: Any?, completion: @escaping @Sendable (HTTPSCallableResult?, (any Error)?) -> Void) {
        do {
            let bytes = try JSONSerialization.data(withJSONObject: input as Any, options: .sortedKeys)
            TestFunctions.shared.capture(name, bytes, completion)
        } catch { completion(nil, error) }
    }
}
public final class TestFunctions: @unchecked Sendable {
    public static let shared = TestFunctions()
    private let lock = NSLock()
    private var callbacks: [@Sendable (HTTPSCallableResult?, (any Error)?) -> Void] = []
    private var requests: [(String, Data)] = []
    public var count: Int { lock.lock(); defer { lock.unlock() }; return requests.count }
    public var pending: Int { lock.lock(); defer { lock.unlock() }; return callbacks.count }
    public var last: (String, Data)? { lock.lock(); defer { lock.unlock() }; return requests.last }
    fileprivate func capture(_ name: String, _ bytes: Data, _ completion: @escaping @Sendable (HTTPSCallableResult?, (any Error)?) -> Void) {
        lock.lock(); defer { lock.unlock() }; requests.append((name, bytes)); callbacks.append(completion)
    }
    public func release(_ bytes: Data?, error: (any Error)? = nil) {
        lock.lock(); precondition(!callbacks.isEmpty); let callback = callbacks.removeFirst(); lock.unlock()
        do { callback(try bytes.map(HTTPSCallableResult.init), error) } catch { callback(nil, error) }
    }
}
