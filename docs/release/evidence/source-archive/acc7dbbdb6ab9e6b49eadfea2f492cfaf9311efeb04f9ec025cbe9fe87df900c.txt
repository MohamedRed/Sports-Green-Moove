import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseFunctions) && canImport(FirebaseAuth)
import FirebaseFunctions
import FirebaseAuth

extension FirebaseBackendGateway {
    func getInbox(uid: String) async throws -> InboxSummary {
        return try await inboxFunction("getInbox", data: [:], uid: uid) { payload in
            guard let inbox = payload["inbox"] as? [String: Any] else { throw ProviderConfigurationError(message: "Inbox manquante.") }
            return try mapInbox(inbox, uid: uid)
        }
    }
    func loadPendingReviews(uid: String, cursor: String) async throws -> PendingReviewPage {
        return try await inboxFunction("getPendingReviews", data: ["cursor": cursor], uid: uid) { payload in
            let page = try PendingReviewWire.parse(payload, uid: uid)
            guard page.nextCursor != cursor else { throw ProviderConfigurationError(message: "Réponse avis invalide.") }
            return page
        }
    }
}

private func inboxFunction<Response: Sendable>(
    _ name: String, data: [String: String], uid: String,
    decode: @escaping @Sendable ([String: Any]) throws -> Response
) async throws -> Response {
    try await firebaseOwnedCall(uid: uid, name: name, input: data) { value in
        guard let payload = value as? [String: Any] else { throw ProviderConfigurationError(message: "Réponse inbox invalide.") }
        return try decode(payload)
    }
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
