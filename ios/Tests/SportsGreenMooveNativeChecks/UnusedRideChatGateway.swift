import Foundation

extension AppDataFixtureGateway {
    func rideChatDirectory(uid: RideChatID, cursor: String?) async throws -> RideChatDirectoryPage { throw RideChatError.unavailable }
    func rideChatBookings(uid: RideChatID, cursor: String?) async throws -> RideChatBookingPage { throw RideChatError.unavailable }
    @MainActor func openRideChat(uid: RideChatID, reference: RideChatReference) async throws -> any RideChatWatch { throw RideChatError.unavailable }
    @MainActor func observeRideChatInbox(uid: RideChatID) throws -> any RideChatInboxWatch { throw RideChatError.unavailable }
    func earlierRideChat(uid: RideChatID, reference: RideChatReference, cursor: RideChatPosition) async throws -> RideChatPage { throw RideChatError.unavailable }
    func sendRideChat(uid: RideChatID, reference: RideChatReference, body: String, requestId: UUID) async throws -> RideChatReceipt { throw RideChatError.unavailable }
    func readRideChat(uid: RideChatID, reference: RideChatReference, ids: [RideChatID]) async throws -> RideChatReadReceipt { throw RideChatError.unavailable }
}
