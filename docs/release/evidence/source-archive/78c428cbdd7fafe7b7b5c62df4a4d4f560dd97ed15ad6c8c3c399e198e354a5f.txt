import Foundation

struct RideChatPosition: Hashable, Comparable, Sendable {
    let seconds: Int64
    let nanos: Int32
    let id: RideChatID
    init(seconds: Int64, nanos: Int32, id: RideChatID) throws {
        guard (-62_135_596_800...253_402_300_799).contains(seconds), (0...999_999_999).contains(nanos) else { throw RideChatError.invalidResponse }
        self.seconds = seconds; self.nanos = nanos; self.id = id
    }
    static func < (a: Self, b: Self) -> Bool {
        if a.seconds != b.seconds { return a.seconds < b.seconds }
        if a.nanos != b.nanos { return a.nanos < b.nanos }; return a.id < b.id
    }
}
struct RideChatAccess: Equatable, Sendable {
    let uid: RideChatID
    let reference: RideChatReference
    let title: String
    let participants: [RideChatID: String?]
}
struct RideChatMessage: Identifiable, Equatable, Sendable {
    let id: RideChatID
    let sender: RideChatID
    let body: String
    let position: RideChatPosition
    let requestId: UUID?
    var needsRead: Bool
    func sameContent(_ other: Self) -> Bool {
        id == other.id && sender == other.sender && RideChatText.same(body, other.body) &&
            position == other.position && requestId == other.requestId
    }
}
struct RideChatPage: Sendable {
    let uid: RideChatID
    let reference: RideChatReference
    let messages: [RideChatMessage]
    let older: RideChatPosition?
}
struct RideChatContext: Equatable, Sendable {
    let title: String
    let departureLabel: String
    let peerLabel: String?
    let childLabel: String?
}
struct RideChatDirectoryRow: Identifiable, Equatable, Sendable {
    let id: RideChatID
    let reference: RideChatReference
    let context: RideChatContext
    let preview: String
    let dateLabel: String
    let unreadCount: Int64
    let revision: Int64
    let position: RideChatPosition
}
struct RideChatDirectoryPage: Sendable {
    let uid: RideChatID
    let items: [RideChatDirectoryRow]
    let excluded: [RideChatID]
    let newest: RideChatPosition?
    let oldest: RideChatPosition?
    let nextCursor: String?
}
struct RideChatBooking: Identifiable, Equatable, Sendable {
    enum Status: String, Sendable {
        case requested, approved, completed, cancelled, declined
        var label: String {
            switch self { case .requested: "En attente"; case .approved: "Acceptée"; case .completed: "Terminée"
            case .cancelled: "Annulée"; case .declined: "Refusée" }
        }
    }
    var id: RideChatReference { reference }
    let reference: RideChatReference
    let context: RideChatContext
    let status: Status
}
struct RideChatBookingPage: Sendable { let uid: RideChatID; let items: [RideChatBooking]; let nextCursor: String? }
struct RideChatReceipt: Sendable {
    let uid: RideChatID
    let reference: RideChatReference
    let requestId: UUID
    let messageId: RideChatID
}
struct RideChatReadReceipt: Sendable { let uid: RideChatID; let reference: RideChatReference; let ids: [RideChatID] }

@MainActor protocol RideChatWatch: AnyObject, Sendable {
    var access: RideChatAccess { get }
    var isCurrent: Bool { get }
    var updates: AsyncThrowingStream<RideChatPage, any Error> { get }
    func close()
}
@MainActor protocol RideChatInboxWatch: AnyObject, Sendable {
    var isCurrent: Bool { get }
    var updates: AsyncThrowingStream<RideChatDirectorySignal, any Error> { get }
    func setReferences(_ references: Set<RideChatReference>) throws
    func close()
}
enum RideChatDirectorySignal: Sendable {
    case indexChanged
    case source(RideChatReference, participants: Set<RideChatID>)
}
protocol RideChatGateway: Sendable {
    func rideChatDirectory(uid: RideChatID, cursor: String?) async throws -> RideChatDirectoryPage
    func rideChatBookings(uid: RideChatID, cursor: String?) async throws -> RideChatBookingPage
    @MainActor func openRideChat(uid: RideChatID, reference: RideChatReference) async throws -> any RideChatWatch
    @MainActor func observeRideChatInbox(uid: RideChatID) throws -> any RideChatInboxWatch
    func earlierRideChat(uid: RideChatID, reference: RideChatReference, cursor: RideChatPosition) async throws -> RideChatPage
    func sendRideChat(uid: RideChatID, reference: RideChatReference, body: String, requestId: UUID) async throws -> RideChatReceipt
    func readRideChat(uid: RideChatID, reference: RideChatReference, ids: [RideChatID]) async throws -> RideChatReadReceipt
}
