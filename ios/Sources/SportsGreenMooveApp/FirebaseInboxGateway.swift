import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseFunctions) && canImport(FirebaseAuth)
import FirebaseFunctions
import FirebaseAuth

extension FirebaseBackendGateway {
    func getInbox() async throws -> InboxSummary {
        guard let uid = Auth.auth().currentUser?.uid else { throw CancellationError() }
        let payload = try await inboxFunction("getInbox", data: [:], uid: uid)
        guard let inbox = payload["inbox"] as? [String: Any] else { throw ProviderConfigurationError(message: "Inbox manquante.") }
        return try mapInbox(inbox, uid: uid)
    }
    func loadPendingReviews(cursor: String) async throws -> PendingReviewPage {
        guard let uid = Auth.auth().currentUser?.uid else { throw CancellationError() }
        let page = try PendingReviewWire.parse(await inboxFunction("getPendingReviews", data: ["cursor": cursor], uid: uid), uid: uid)
        guard page.nextCursor != cursor else { throw ProviderConfigurationError(message: "Réponse avis invalide.") }
        return page
    }
}

private func inboxFunction(_ name: String, data: [String: Any], uid: String) async throws -> [String: Any] {
    let payload: [String: Any] = try await withCheckedThrowingContinuation { continuation in
        Functions.functions().httpsCallable(name).call(data) { result, error in
            if let error { continuation.resume(throwing: error) }
            else if let payload = result?.data as? [String: Any] { continuation.resume(returning: payload) }
            else { continuation.resume(throwing: ProviderConfigurationError(message: "Réponse inbox invalide.")) }
        }
    }
    try Task.checkCancellation()
    guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
    return payload
}

private func mapInbox(_ data: [String: Any], uid: String) throws -> InboxSummary {
    guard let userId = data["reviewsUserId"], let items = data["reviews"], let cursor = data["reviewsNextCursor"] else {
        throw ProviderConfigurationError(message: "Réponse avis invalide.")
    }
    let page = try PendingReviewWire.parse(["userId": userId, "items": items, "nextCursor": cursor], uid: uid)
    return InboxSummary(
        notifications: array(data["notifications"]).compactMap(mapInboxNotification),
        chats: array(data["chats"]).compactMap(mapInboxChat),
        reviews: page.items, reviewsNextCursor: page.nextCursor, reviewsUserId: uid
    )
}

private func mapInboxNotification(_ data: [String: Any]) -> InboxNotificationSummary? {
    guard let id = data["id"] as? String else { return nil }
    return InboxNotificationSummary(
        id: id,
        title: data["title"] as? String ?? "Notification",
        body: data["body"] as? String ?? "",
        dateLabel: data["dateLabel"] as? String ?? "",
        unread: data["unread"] as? Bool ?? false,
        initials: data["initials"] as? String ?? "NT"
    )
}

private func mapInboxChat(_ data: [String: Any]) -> InboxChatSummary? {
    guard let id = data["id"] as? String, let sourceId = data["sourceId"] as? String else { return nil }
    return InboxChatSummary(
        id: id,
        sourceType: data["sourceType"] as? String ?? "booking",
        sourceId: sourceId,
        title: data["title"] as? String ?? "Conversation",
        preview: data["preview"] as? String ?? "",
        dateLabel: data["dateLabel"] as? String ?? "",
        unreadCount: (data["unreadCount"] as? NSNumber)?.intValue ?? 0,
        initials: data["initials"] as? String ?? "CH"
    )
}

private func array(_ value: Any?) -> [[String: Any]] {
    (value as? [[String: Any]]) ?? []
}
#endif
