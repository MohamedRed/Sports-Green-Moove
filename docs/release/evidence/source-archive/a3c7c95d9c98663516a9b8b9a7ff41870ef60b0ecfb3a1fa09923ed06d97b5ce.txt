import Foundation

// Only the counter crosses callback queues; every access is protected by the lock.
final class RideChatCallbackClock: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Int64 = 0
    func next() throws -> Int64 {
        lock.lock(); defer { lock.unlock() }
        guard value < Int64.max else { throw RideChatError.invalidResponse }
        value += 1; return value
    }
}
