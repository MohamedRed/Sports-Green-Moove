import Foundation

public typealias AuthStateDidChangeListenerHandle = String
public final class User: Sendable {
    public let uid: String
    public init(_ uid: String) { self.uid = uid }
}
public final class Auth: @unchecked Sendable {
    private static let instance = Auth()
    private let lock = NSLock()
    private var user: User?
    private var listeners: [String: @Sendable (Auth, User?) -> Void] = [:]
    public static func auth() -> Auth { instance }
    public var currentUser: User? { lock.lock(); defer { lock.unlock() }; return user }
    public var listenerCount: Int { lock.lock(); defer { lock.unlock() }; return listeners.count }
    public func setUser(_ uid: String?) {
        lock.lock(); user = uid.map(User.init); let value = user, callbacks = Array(listeners.values); lock.unlock()
        callbacks.forEach { $0(self, value) }
    }
    public func addStateDidChangeListener(_ listener: @escaping @Sendable (Auth, User?) -> Void) -> String {
        lock.lock(); let id = UUID().uuidString; listeners[id] = listener; let value = user; lock.unlock()
        listener(self, value); return id
    }
    public func removeStateDidChangeListener(_ handle: String) { lock.lock(); defer { lock.unlock() }; listeners[handle] = nil }
}
