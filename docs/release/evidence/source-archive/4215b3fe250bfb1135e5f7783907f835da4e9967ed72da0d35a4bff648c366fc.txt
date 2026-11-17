import Foundation

@MainActor func checkSupportSubmission() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("support-checks-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = SupportSubmissionStore(directory: directory)
    var calls: [SupportSubmission] = []
    let first = SupportSubmissionState(uid: "parent", submitter: { calls.append($0); throw SupportSubmissionError.receipt }, makeStore: { store })
    first.setDescription("Demande de test"); first.setEmergency(true); await first.submit()
    let operation = try store.read(uid: "parent")!
    check(calls == [operation] && first.pending == operation && !first.editable, "Lost response must retain one immutable support send")
    first.setDescription("Changed"); first.setEmergency(false)
    check(first.description == operation.description && first.emergency, "Unconfirmed content must stay frozen")
    first.close(); check(first.description.isEmpty && first.pending == nil, "Disposed account must not retain support text")
    let reopened = SupportSubmissionState(uid: "parent", submitter: { calls.append($0); return "report" },
        makeStore: { SupportSubmissionStore(directory: directory) })
    check(reopened.pending == operation && reopened.emergency && calls.count == 1, "Reopen must restore without automatically sending")
    let driver = SupportSubmissionState(uid: "driver", submitter: { _ in fatalError("Must not send") }, makeStore: { store })
    check(driver.pending == nil && driver.description.isEmpty, "Another account saw the parent's pending support data")
    await reopened.submit()
    check(calls == [operation, operation] && reopened.pending == nil, "Explicit retry changed the support identity")
    let confirmed = try store.read(uid: "parent"); check(confirmed == nil, "Confirmed operation must be cleared")
    let saved = try store.begin(operation)
    try store.acknowledge(uid: "parent", requestId: UUID().uuidString)
    let retained = try store.read(uid: "parent"); check(retained == saved, "Stale acknowledge cleared another send")
    var changed = operation; changed.subjectType = "user"
    do { _ = try store.begin(changed); fatalError("Changed operation was accepted") } catch SupportSubmissionError.conflict { }
    let receipt: [String: Any] = ["clientRequestId": operation.requestId, "requesterUserId": operation.uid,
        "status": "open", "reportId": String(repeating: "a", count: 64), "reused": true]
    let id = try operation.acknowledgedReport(receipt); check(id == String(repeating: "a", count: 64), "Valid support receipt was rejected")
    for patch in [["requesterUserId": "foreign"], ["clientRequestId": "different"], ["status": "closed"], ["reportId": "bad"], ["reused": "true"]] {
        do { _ = try operation.acknowledgedReport(receipt.merging(patch) { _, new in new }); fatalError("Unbound receipt was accepted") }
        catch SupportSubmissionError.receipt { }
    }
    let file = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).first!
    try Data("corrupted".utf8).write(to: file)
    let corrupt = SupportSubmissionState(uid: "parent", submitter: { _ in fatalError("Must not send with corrupt storage") }, makeStore: { store })
    check(!corrupt.ready && !corrupt.editable, "Corrupt storage became an empty draft")
    await corrupt.submit(); check(!corrupt.ready, "Corrupt storage was replaced")
    let failed = SupportSubmissionState(uid: "parent", submitter: { _ in fatalError("Must not send") },
        makeStore: { throw SupportSubmissionError.storage })
    failed.setDescription("Demande de test"); await failed.submit(); check(!failed.ready, "Storage failure did not block send")
    print("SupportSubmissionChecks passed: persistence, explicit retry, immutability, account isolation, bound receipts and fail-closed storage")
}
