import Foundation

@MainActor
protocol LogoutIntentStore {
    func requiresSignOut() throws -> Bool
    func setRequiresSignOut(_ value: Bool) throws
}

@MainActor
final class FileLogoutIntentStore: LogoutIntentStore {
    private struct Record: Codable { let version: Int; let requiresSignOut: Bool }
    private let file: URL

    init(file: URL) { self.file = file }

    static func platformStore() throws -> FileLogoutIntentStore {
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true).appendingPathComponent("SportsGreenMoove", isDirectory: true)
            .appendingPathComponent("authentication", isDirectory: true)
        return FileLogoutIntentStore(file: root.appendingPathComponent("session-policy.json"))
    }

    func requiresSignOut() throws -> Bool {
        let data: Data
        do { data = try Data(contentsOf: file) }
        catch CocoaError.fileReadNoSuchFile { return true }
        let record = try JSONDecoder().decode(Record.self, from: data)
        guard record.version == 1 else { throw AuthenticationFailure.storage }
        return record.requiresSignOut
    }

    func setRequiresSignOut(_ value: Bool) throws {
        let directory = file.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        #if os(iOS)
        var attributes = URLResourceValues(); attributes.isExcludedFromBackup = true
        var url = directory; try url.setResourceValues(attributes)
        let options: Data.WritingOptions = [.atomic, .completeFileProtection]
        #else
        let options: Data.WritingOptions = .atomic
        #endif
        try JSONEncoder().encode(Record(version: 1, requiresSignOut: value)).write(to: file, options: options)
        let handle = try FileHandle(forWritingTo: file)
        defer { try? handle.close() }
        try handle.synchronize()
    }
}
