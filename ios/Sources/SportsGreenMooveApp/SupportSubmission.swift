import Foundation
import CoreFoundation

struct SupportSubmission: Codable, Equatable, Sendable {
    let uid: String
    let requestId: String
    let reason: String
    let description: String
    let emergency: Bool
    var subjectType = "other"
    var subjectId: String?
    var isValid: Bool {
        !uid.isEmpty && uid.utf16.count <= 128 && UUID(uuidString: requestId)?.uuidString.lowercased() == requestId &&
        reason == reason.trimmingCharacters(in: .whitespacesAndNewlines) && (2...120).contains(reason.utf16.count) &&
        description == description.trimmingCharacters(in: .whitespacesAndNewlines) && (5...2000).contains(description.utf16.count) &&
        ["booking", "rideSession", "message", "user", "other"].contains(subjectType) &&
        (subjectId == nil || (subjectId == subjectId?.trimmingCharacters(in: .whitespacesAndNewlines) && (1...1500).contains(subjectId!.utf16.count)))
    }
    var payload: [String: Any] {
        var data: [String: Any] = ["requesterUserId": uid, "clientRequestId": requestId, "subjectType": subjectType,
            "reason": reason, "description": description, "emergency": emergency]
        if let subjectId { data["subjectId"] = subjectId }
        return data
    }
    func acknowledgedReport(_ input: Any) throws -> String {
        guard let payload = input as? [String: Any], payload["clientRequestId"] as? String == requestId,
              payload["requesterUserId"] as? String == uid, payload["status"] as? String == "open",
              let reused = payload["reused"] as? NSNumber, CFGetTypeID(reused) == CFBooleanGetTypeID(),
              let id = payload["reportId"] as? String, id.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil
        else { throw SupportSubmissionError.receipt }
        return id
    }
}

enum SupportSubmissionError: Error { case storage, invalid, conflict, account, receipt }

final class SupportSubmissionStore: @unchecked Sendable {
    private static let lock = NSLock()
    private let directory: URL
    init(directory: URL) { self.directory = directory }
    static func platformStore() throws -> SupportSubmissionStore {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true).appendingPathComponent("SportsGreenMoove/pending-support", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        #if os(iOS)
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        var url = directory; try url.setResourceValues(values)
        #endif
        return .init(directory: directory)
    }
    private func file(_ uid: String) throws -> URL {
        guard !uid.isEmpty, uid.utf16.count <= 128 else { throw SupportSubmissionError.invalid }
        let name = Data(uid.utf8).base64EncodedString().replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "+", with: "-")
        return directory.appendingPathComponent(name + ".json")
    }
    private func readUnlocked(_ uid: String) throws -> SupportSubmission? {
        let url = try file(uid)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let value = try JSONDecoder().decode(SupportSubmission.self, from: Data(contentsOf: url))
        guard value.uid == uid, value.isValid else { throw SupportSubmissionError.storage }
        return value
    }
    func read(uid: String) throws -> SupportSubmission? {
        Self.lock.lock(); defer { Self.lock.unlock() }; return try readUnlocked(uid)
    }
    func begin(_ value: SupportSubmission) throws -> SupportSubmission {
        Self.lock.lock(); defer { Self.lock.unlock() }
        guard value.isValid else { throw SupportSubmissionError.invalid }
        if let current = try readUnlocked(value.uid) {
            guard current == value else { throw SupportSubmissionError.conflict }; return current
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        #if os(iOS)
        try JSONEncoder().encode(value).write(to: file(value.uid), options: [.atomic, .completeFileProtection])
        #else
        try JSONEncoder().encode(value).write(to: file(value.uid), options: .atomic)
        #endif
        return value
    }
    func acknowledge(uid: String, requestId: String) throws {
        Self.lock.lock(); defer { Self.lock.unlock() }
        if try readUnlocked(uid)?.requestId == requestId { try FileManager.default.removeItem(at: file(uid)) }
    }
}
