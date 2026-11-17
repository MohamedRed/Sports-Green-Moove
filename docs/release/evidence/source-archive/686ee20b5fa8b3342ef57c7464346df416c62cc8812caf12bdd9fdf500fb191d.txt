import Foundation

#if DEBUG
@MainActor final class UITestRideChatWatch: RideChatWatch {
    let access: RideChatAccess
    let updates: AsyncThrowingStream<RideChatPage, any Error>
    private let continuation: AsyncThrowingStream<RideChatPage, any Error>.Continuation
    private(set) var isCurrent = true
    init(access: RideChatAccess) {
        self.access = access
        (updates, continuation) = AsyncThrowingStream.makeStream(bufferingPolicy: .bufferingNewest(1))
    }
    func publish(_ page: RideChatPage) { if isCurrent { continuation.yield(page) } }
    func close() { isCurrent = false; continuation.finish() }
}
@MainActor final class UITestRideChatInboxWatch: RideChatInboxWatch {
    let updates: AsyncThrowingStream<RideChatDirectorySignal, any Error>
    private let continuation: AsyncThrowingStream<RideChatDirectorySignal, any Error>.Continuation
    private(set) var isCurrent = true
    let uid: RideChatID
    let driver: RideChatID
    private var references = Set<RideChatReference>()
    init(uid: RideChatID, driver: RideChatID) {
        self.uid = uid; self.driver = driver
        (updates, continuation) = AsyncThrowingStream.makeStream()
    }
    func changed() { if isCurrent { continuation.yield(.indexChanged) } }
    func setReferences(_ references: Set<RideChatReference>) throws {
        guard isCurrent else { throw RideChatError.accessRejected }
        for reference in references.subtracting(self.references) { continuation.yield(.source(reference, participants: [uid, driver])) }
        self.references = references
    }
    func close() { isCurrent = false; continuation.finish() }
}
#endif
