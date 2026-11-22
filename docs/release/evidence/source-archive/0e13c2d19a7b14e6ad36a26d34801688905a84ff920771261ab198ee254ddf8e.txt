import Foundation

enum PrivateChatDraftFiles {
    static let lock = NSLock()
    enum Failure: Error { case invalid }
    static func directory(_ name: String) throws -> URL {
        guard ["team-drafts", "ride-drafts"].contains(name) else { throw Failure.invalid }
        let parent = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true)
        var directory = parent.appendingPathComponent("SportsGreenMoove/" + name, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let info = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard info.isDirectory == true, info.isSymbolicLink != true else { throw Failure.invalid }
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try directory.setResourceValues(values); return directory
    }
    static func read<Record: Decodable>(_ type: Record.Type, from path: URL) throws -> Record? {
        let directory = path.deletingLastPathComponent()
        if FileManager.default.fileExists(atPath: directory.path) {
            let info = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
            guard info.isDirectory == true, info.isSymbolicLink != true else { throw Failure.invalid }
        }
        guard FileManager.default.fileExists(atPath: path.path) else { return nil }
        let values = try path.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true,
              (values.fileSize ?? Int.max) <= 131_072 else { throw Failure.invalid }
        return try JSONDecoder().decode(type, from: Data(contentsOf: path))
    }
    static func write<Record: Encodable>(_ record: Record, to path: URL) throws {
        let directory = path.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let info = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard info.isDirectory == true, info.isSymbolicLink != true else { throw Failure.invalid }
        #if os(iOS)
        try JSONEncoder().encode(record).write(to: path, options: [.atomic, .completeFileProtection])
        #else
        try JSONEncoder().encode(record).write(to: path, options: .atomic)
        #endif
    }
}
