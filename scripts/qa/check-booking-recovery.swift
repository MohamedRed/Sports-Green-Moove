import Foundation

enum CheckFailure: Error { case lost, assertion(String) }
final class RecoveryAccount: @unchecked Sendable {
    private let lock = NSLock()
    private var uid = "parent"
    func read() -> String { lock.lock(); defer { lock.unlock() }; return uid }
    func switchAccount() { lock.lock(); defer { lock.unlock() }; uid = "other" }
}
actor RecoveryTransport: BookingRequestTransport {
    var fail = false
    var malformed = false
    var resolved = false
    var submissions: [(String, String, PendingBookingIntent)] = []
    var resolutions = 0
    var currentStatus = "requested"
    var onSubmit: @Sendable () -> Void = {}
    func configure(fail: Bool = false, malformed: Bool = false, resolved: Bool = false, currentStatus: String = "requested") {
        self.fail = fail; self.malformed = malformed; self.resolved = resolved
        self.currentStatus = currentStatus
    }
    func switchAccountOnSubmit(_ account: RecoveryAccount) { onSubmit = { account.switchAccount() } }
    func submit(intent: PendingBookingIntent, uid: String, requestId: String) throws -> BookingAcknowledgement {
        submissions.append((uid, requestId, intent))
        onSubmit()
        if fail { throw CheckFailure.lost }
        return BookingAcknowledgement(bookingId: "saved", requestId: malformed ? "wrong" : requestId, tripId: intent.tripId,
            status: "requested", currentStatus: currentStatus)
    }
    func resolve(uid: String, requestId: String) throws -> BookingResolution {
        resolutions += 1
        if fail { throw CheckFailure.lost }
        return resolved ? .committed("saved") : .abandoned
    }
}

@main struct BookingRecoveryCheck {
    static func fixture() throws -> PendingBookingIntent {
        let payload: [String: Any] = ["terms": ["departureAt": "2027-01-10T10:00:00.000Z", "arrivalBy": NSNull(),
            "origin": ["lat": 50.7, "lng": 4.6], "destination": ["lat": 50.8, "lng": 4.3], "priceCents": 250],
            "context": ["driverUserId": "driver", "seatsTotal": 4]]
        guard let terms = BookingIntentSnapshot.fromPayload(payload) else { throw CheckFailure.assertion("fixture") }
        return PendingBookingIntent(tripId: "trip", childId: "child", seats: 2, terms: terms)
    }
    static func main() async throws {
        let mode = CommandLine.arguments[1]
        let directory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        let output = URL(fileURLWithPath: CommandLine.arguments[3])
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let intent = try fixture(), slot = BookingOperationSlot(uid: "parent", tripId: "trip", childId: "child")
        let durableFile = directory.appendingPathComponent("durable.json")
        var cases: [[String: String]] = []
        func pass(_ name: String, _ condition: Bool) throws {
            guard condition else { throw CheckFailure.assertion(name) }
            cases.append(["id": name, "status": "passed"])
        }
        func make(_ name: String) -> PendingBookingStore {
            PendingBookingStore(file: directory.appendingPathComponent(name + ".json"))
        }
        if mode == "prepare" {
            let pending = try PendingBookingStore(file: durableFile).begin(slot: slot, intent: intent)
            try Data(pending.requestId.utf8).write(to: directory.appendingPathComponent("expected-id.txt"), options: .atomic)
            try pass("identity-written-before-process-exit", UUID(uuidString: pending.requestId) != nil)
        } else if mode == "recover" {
            let expected = try String(contentsOf: directory.appendingPathComponent("expected-id.txt"), encoding: .utf8)
            let pending = try PendingBookingStore(file: durableFile).begin(slot: slot, intent: intent)
            try pass("a-separate-process-recovers-the-same-identity-and-intent", pending.requestId == expected && pending.intent == intent)
        } else {
            do {
                let file = directory.appendingPathComponent("retry.json"), transport = RecoveryTransport()
                await transport.configure(fail: true)
                let first = BookingRequestCoordinator(store: PendingBookingStore(file: file), transport: transport, currentUid: { "parent" })
                do { _ = try await first.request(intent); throw CheckFailure.assertion("expected loss") } catch CheckFailure.lost {}
                await transport.configure()
                let recovered = try await BookingRequestCoordinator(store: PendingBookingStore(file: file), transport: transport,
                    currentUid: { "parent" }).request(intent)
                let calls = await transport.submissions
                try pass("lost-reply-reuses-the-exact-persisted-operation", recovered == "saved" && calls.count == 2 &&
                    calls[0].1 == calls[1].1 && calls[0].2 == calls[1].2 && calls[0].0 == "parent")
                let next = try PendingBookingStore(file: file).begin(slot: slot, intent: intent)
                try pass("acknowledgement-allows-a-new-explicit-operation", next.requestId != calls[0].1)
            }
            do {
                let store = make("changed"), transport = RecoveryTransport()
                let old = try store.begin(slot: slot, intent: intent)
                let changed = PendingBookingIntent(tripId: intent.tripId, childId: intent.childId, seats: 3, terms: intent.terms)
                _ = try await BookingRequestCoordinator(store: store, transport: transport, currentUid: { "parent" }).request(changed)
                let calls = await transport.submissions, resolutions = await transport.resolutions
                try pass("changed-details-fence-the-old-attempt-before-submission", resolutions == 1 && calls.count == 1 &&
                    calls[0].1 != old.requestId && calls[0].2.seats == 3)
            }
            do {
                let store = make("committed"), transport = RecoveryTransport()
                _ = try store.begin(slot: slot, intent: intent); await transport.configure(resolved: true)
                let changed = PendingBookingIntent(tripId: intent.tripId, childId: intent.childId, seats: 3, terms: intent.terms)
                do {
                    _ = try await BookingRequestCoordinator(store: store, transport: transport, currentUid: { "parent" }).request(changed)
                    throw CheckFailure.assertion("expected already recorded")
                } catch BookingRecoveryError.alreadyRecorded {}
                try pass("an-already-committed-intent-does-not-submit-changed-details", await transport.submissions.isEmpty)
            }
            do {
                let store = make("unresolved"), transport = RecoveryTransport(), old = try store.begin(slot: slot, intent: intent)
                await transport.configure(fail: true)
                let changed = PendingBookingIntent(tripId: intent.tripId, childId: intent.childId, seats: 3, terms: intent.terms)
                do { _ = try await BookingRequestCoordinator(store: store, transport: transport, currentUid: { "parent" }).request(changed)
                    throw CheckFailure.assertion("expected resolution loss") } catch CheckFailure.lost {}
                let retained = try store.begin(slot: slot, intent: intent)
                let submitted = await transport.submissions
                try pass("failed-resolution-preserves-the-old-operation", retained.requestId == old.requestId &&
                    submitted.isEmpty)
            }
            do {
                let store = make("malformed"), transport = RecoveryTransport(); await transport.configure(malformed: true)
                let old = try store.begin(slot: slot, intent: intent)
                do { _ = try await BookingRequestCoordinator(store: store, transport: transport, currentUid: { "parent" }).request(intent)
                    throw CheckFailure.assertion("expected invalid receipt") } catch BookingRecoveryError.invalidReceipt {}
                try pass("mismatched-acknowledgement-does-not-clear-the-identity", try store.begin(slot: slot, intent: intent).requestId == old.requestId)
            }
            do {
                let store = make("accounts"), parent = try store.begin(slot: slot, intent: intent)
                let other = try store.begin(slot: BookingOperationSlot(uid: "other", tripId: "trip", childId: "child"), intent: intent)
                try pass("accounts-cannot-share-pending-identities", parent.requestId != other.requestId)
                try store.acknowledge(slot: slot, requestId: parent.requestId)
                let new = try store.begin(slot: slot, intent: intent)
                try store.acknowledge(slot: slot, requestId: parent.requestId)
                try pass("late-acknowledgement-cannot-clear-a-new-operation", try store.begin(slot: slot, intent: intent).requestId == new.requestId)
            }
            do {
                let account = RecoveryAccount(), store = make("changed-account"), transport = RecoveryTransport()
                let old = try store.begin(slot: slot, intent: intent)
                await transport.switchAccountOnSubmit(account)
                do { _ = try await BookingRequestCoordinator(store: store, transport: transport, currentUid: { account.read() }).request(intent)
                    throw CheckFailure.assertion("expected changed account") } catch BookingRecoveryError.accountChanged {}
                try pass("account-switch-cannot-acknowledge-another-accounts-operation",
                    try store.begin(slot: slot, intent: intent).requestId == old.requestId)
            }
            do {
                for status in ["cancelled", "declined", "completed"] {
                    let store = make("closed-" + status), transport = RecoveryTransport()
                    let old = try store.begin(slot: slot, intent: intent)
                    await transport.configure(currentStatus: status)
                    do { _ = try await BookingRequestCoordinator(store: store, transport: transport, currentUid: { "parent" }).request(intent)
                        throw CheckFailure.assertion("expected closed booking") } catch BookingRecoveryError.alreadyProcessed {}
                    let next = try store.begin(slot: slot, intent: intent)
                    guard next.requestId != old.requestId else { throw CheckFailure.assertion("closed acknowledgement not cleared") }
                }
                try pass("closed-bookings-are-recovered-without-claiming-a-new-request", true)
            }
            do {
                let file = directory.appendingPathComponent("corrupt.json")
                try Data("not-json".utf8).write(to: file)
                let transport = RecoveryTransport()
                do { _ = try await BookingRequestCoordinator(store: PendingBookingStore(file: file), transport: transport,
                    currentUid: { "parent" }).request(intent); throw CheckFailure.assertion("expected storage failure") }
                catch BookingRecoveryError.storage {}
                try pass("corrupt-storage-cannot-silently-create-a-fresh-identity", await transport.submissions.isEmpty)
            }
            do {
                let blocker = directory.appendingPathComponent("not-a-directory"); try Data().write(to: blocker)
                let transport = RecoveryTransport()
                do { _ = try await BookingRequestCoordinator(store: PendingBookingStore(file: blocker.appendingPathComponent("pending.json")),
                    transport: transport, currentUid: { "parent" }).request(intent); throw CheckFailure.assertion("expected disk failure") }
                catch BookingRecoveryError.storage {}
                try pass("disk-write-failure-blocks-network-submission", await transport.submissions.isEmpty)
            }
        }
        let report: [String: Any] = ["scope": "foundation-booking-recovery-not-ios-ui", "cases": cases, "passed": true,
            "testedAt": ISO8601DateFormatter().string(from: Date())]
        try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: output)
        print("Booking recovery \(mode): \(cases.count) cases passed")
    }
}
