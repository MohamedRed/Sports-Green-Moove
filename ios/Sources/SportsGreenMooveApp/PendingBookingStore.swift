import Foundation

struct PendingBookingIntent: Codable, Equatable, Sendable {
    let tripId: String
    let childId: String?
    let seats: Int
    let terms: BookingIntentSnapshot
}
struct BookingOperationSlot: Codable, Sendable {
    let uid: String
    let tripId: String
    let childId: String?
    func key() throws -> String {
        let encoder = JSONEncoder(); encoder.outputFormatting = .sortedKeys
        return try encoder.encode(self).base64EncodedString()
    }
}
struct PendingBookingOperation: Codable, Sendable {
    let requestId: String
    let intent: PendingBookingIntent
}

final class PendingBookingStore: @unchecked Sendable {
    private static let lock = NSLock()
    private let file: URL
    init(file: URL) { self.file = file }

    static func platformStore() throws -> PendingBookingStore {
        do {
            let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                appropriateFor: nil, create: true).appendingPathComponent("SportsGreenMoove", isDirectory: true)
            return PendingBookingStore(file: directory.appendingPathComponent("pending-bookings.json"))
        } catch { throw BookingRecoveryError.storage }
    }
    func begin(slot: BookingOperationSlot, intent: PendingBookingIntent) throws -> PendingBookingOperation {
        Self.lock.lock(); defer { Self.lock.unlock() }
        var records = try read()
        let key = try slot.key()
        if let existing = records[key] { return existing }
        let operation = PendingBookingOperation(requestId: UUID().uuidString.lowercased(), intent: intent)
        records[key] = operation
        try write(records)
        return operation
    }
    func acknowledge(slot: BookingOperationSlot, requestId: String) throws {
        Self.lock.lock(); defer { Self.lock.unlock() }
        var records = try read()
        let key = try slot.key()
        if records[key]?.requestId == requestId { records.removeValue(forKey: key); try write(records) }
    }
    private func read() throws -> [String: PendingBookingOperation] {
        do {
            if !FileManager.default.fileExists(atPath: file.path) { return [:] }
            let records = try JSONDecoder().decode([String: PendingBookingOperation].self, from: Data(contentsOf: file))
            for (key, operation) in records {
                guard let data = Data(base64Encoded: key),
                      let slot = try? JSONDecoder().decode(BookingOperationSlot.self, from: data), !slot.uid.isEmpty,
                      slot.tripId == operation.intent.tripId, slot.childId == operation.intent.childId,
                      UUID(uuidString: operation.requestId)?.uuidString.lowercased() == operation.requestId,
                      operation.intent.terms.isValid, (1...8).contains(operation.intent.seats) else { throw BookingRecoveryError.storage }
            }
            return records
        } catch { throw BookingRecoveryError.storage }
    }
    private func write(_ records: [String: PendingBookingOperation]) throws {
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(records).write(to: file, options: .atomic)
            #if os(iOS)
            var attributes = URLResourceValues(); attributes.isExcludedFromBackup = true
            var url = file; try url.setResourceValues(attributes)
            #endif
        } catch { throw BookingRecoveryError.storage }
    }
}
