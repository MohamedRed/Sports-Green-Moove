import Foundation

enum PendingReviewWire {
    static func parse(_ raw: Any?, uid: String) throws -> PendingReviewPage {
        guard !uid.isEmpty, let data = raw as? [String: Any], Set(data.keys) == ["userId", "items", "nextCursor"],
              data["userId"] as? String == uid, let rows = data["items"] as? [[String: Any]], rows.count <= 20 else { throw invalid }
        let cursor: String?
        if data["nextCursor"] is NSNull { cursor = nil }
        else {
            guard let value = data["nextCursor"] as? String, !value.isEmpty, value.utf8.count <= 16_384,
                  value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else { throw invalid }
            cursor = value
        }
        let items = try rows.map { row -> InboxReviewPrompt in
            func field(_ key: String) throws -> String {
                guard let value = row[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw invalid }
                return value
            }
            let id = try field("id"), ride = try field("rideSessionId"), target = try field("ratedUserId")
            guard target != uid, id == "\(ride)_\(uid)_\(target)" else { throw invalid }
            return try .init(id: id, rideSessionId: ride, ratedUserId: target,
                             title: field("title"), prompt: field("prompt"), initials: field("initials"))
        }
        guard Set(items.map(\.id)).count == items.count else { throw invalid }
        return .init(userId: uid, items: items, nextCursor: cursor)
    }
    private static var invalid: ProviderConfigurationError { .init(message: "Réponse avis invalide.") }
}
