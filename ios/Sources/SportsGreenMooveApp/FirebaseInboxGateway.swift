import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseFunctions)
import FirebaseFunctions

extension FirebaseBackendGateway {
    func getInbox() async throws -> InboxSummary {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("getInbox").call([:]) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let inbox = payload["inbox"] as? [String: Any] {
                    continuation.resume(returning: mapInbox(inbox))
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse inbox invalide."))
                }
            }
        }
    }
}

private func mapInbox(_ data: [String: Any]) -> InboxSummary {
    InboxSummary(
        notifications: array(data["notifications"]).compactMap(mapInboxNotification),
        chats: array(data["chats"]).compactMap(mapInboxChat),
        reviews: array(data["reviews"]).compactMap(mapInboxReview)
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

private func mapInboxReview(_ data: [String: Any]) -> InboxReviewPrompt? {
    guard let id = data["id"] as? String,
          let rideSessionId = data["rideSessionId"] as? String,
          let ratedUserId = data["ratedUserId"] as? String
    else { return nil }
    return InboxReviewPrompt(
        id: id,
        rideSessionId: rideSessionId,
        ratedUserId: ratedUserId,
        title: data["title"] as? String ?? "Avis de course",
        prompt: data["prompt"] as? String ?? "",
        initials: data["initials"] as? String ?? "AV"
    )
}

private func array(_ value: Any?) -> [[String: Any]] {
    (value as? [[String: Any]]) ?? []
}
#endif
