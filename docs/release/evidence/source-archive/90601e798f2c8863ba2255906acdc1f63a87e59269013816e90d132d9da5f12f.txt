import Foundation
import FirebaseAuth
import FirebaseFirestore

func require(_ value: @autoclosure () -> Bool, _ message: String) { precondition(value(), message) }
@MainActor func settle() async { for _ in 0..<100 { await Task.yield() } }
@MainActor func eventually(_ condition: () -> Bool) async {
    let deadline = ContinuousClock.now.advanced(by: .seconds(10))
    while !condition() { precondition(ContinuousClock.now < deadline, "Scripted SDK callback never settled"); await Task.yield() }
}
let uid = try RideChatID("parent"), driver = try RideChatID("driver")
let ref = RideChatReference(kind: .booking, sourceId: try RideChatID("booking"))
let access = RideChatAccess(uid: uid, reference: ref, title: "Conversation", participants: [uid: nil, driver: "Conducteur"])
let path = "bookings/booking", sdk = TestFirestore.shared
func source(_ fields: [String: Any], cache: Bool = false, pending: Bool = false, exists: Bool = true) -> DocumentSnapshot {
    .init(id: "booking", data: fields, exists: exists, metadata: .init(cache: cache, pending: pending))
}
func message(cache: Bool = false, pending: Bool = false) -> QuerySnapshot {
    .init(documents: [.init(id: "message", data: ["sourceType": "booking", "sourceId": "booking",
        "participantUserIds": ["parent", "driver"], "senderUserId": "driver", "body": "Message isolé",
        "createdAt": Timestamp(seconds: 1_800_000_000, nanoseconds: 0)])], metadata: .init(cache: cache, pending: pending))
}
let valid: [String: Any] = ["parentUserId": "parent", "driverUserId": "driver"]
var groups = 0
for invalidation in ["deleted", "parent-removed", "driver-changed", "truthy-malformed", "pending-source", "source-transport", "permission-denied", "auth", "pending-message", "message-error", "close"] {
    Auth.auth().setUser("parent")
    let watch = FirebaseRideChatThreadWatch(access: access)
    var pages: [RideChatPage] = [], failed = false
    let consumer = Task { @MainActor in
        do { for try await page in watch.updates { pages.append(page) } } catch { failed = true }
    }
    require(!watch.isCurrent && sdk.queryCount("messages") == 0, "Listener opened before current source grant")
    sdk.emitDocument(path, source(valid, cache: true)); await settle()
    require(!watch.isCurrent && sdk.queryCount("messages") == 0, "Cached source granted access")
    sdk.emitDocument(path, source(valid)); await eventually { watch.isCurrent && sdk.queryCount("messages") == 1 }
    sdk.emitQuery("messages", message(cache: true)); await settle()
    require(pages.isEmpty, "Cached message content escaped")
    sdk.emitQuery("messages", message()); await eventually { pages.count == 1 }
    switch invalidation {
    case "deleted": sdk.emitDocument(path, source([:], exists: false))
    case "parent-removed": sdk.emitDocument(path, source(["parentUserId": "foreign", "driverUserId": "driver"]))
    case "driver-changed": sdk.emitDocument(path, source(["parentUserId": "parent", "driverUserId": "new-driver"]))
    case "truthy-malformed": sdk.emitDocument(path, source(["parentUserId": "parent", "driverUserId": true]))
    case "pending-source": sdk.emitDocument(path, source(valid, pending: true))
    case "source-transport": sdk.emitDocument(path, nil, error: NSError(domain: "isolated-transport", code: 1))
    case "permission-denied": sdk.emitDocument(path, nil, error: NSError(domain: FirestoreErrorDomain, code: FirestoreErrorCode.permissionDenied.rawValue))
    case "auth": Auth.auth().setUser("other")
    case "pending-message": sdk.emitQuery("messages", message(pending: true))
    case "message-error": sdk.emitQuery("messages", nil, error: NSError(domain: "isolated-transport", code: 2))
    default: watch.close()
    }
    await consumer.value
    require(!watch.isCurrent && sdk.listenerCount == 0 && Auth.auth().listenerCount == 0, "Thread retained an SDK registration")
    require(failed == (invalidation != "close"), "Invalidation was presented as successful history completion")
    sdk.emitDocument(path, source(valid), late: true); sdk.emitQuery("messages", message(), late: true); await settle()
    require(pages.count == 1 && sdk.listenerCount == 0, "Late removed callbacks restored private content/listeners")
    watch.close(); groups += 1
}
Auth.auth().setUser("parent")
let inbox = FirebaseRideChatInboxWatch(uid: uid)
var sources = 0, indexes = 0
let consumer = Task { @MainActor in
    do {
        for try await signal in inbox.updates {
            switch signal { case .indexChanged: indexes += 1; case .source: sources += 1 }
        }
    } catch {}
}
sdk.emitQuery("chatInboxes", .init(metadata: .init(cache: true))); await settle()
require(indexes == 0, "Cached index triggered trusted directory refresh")
sdk.emitQuery("chatInboxes", .init()); await eventually { indexes == 1 }
try inbox.setReferences([ref]); sdk.emitDocument(path, source(valid)); await eventually { sources == 1 }
try inbox.setReferences([]); sdk.emitDocument(path, source(valid), late: true); await settle()
require(sources == 1 && sdk.listenerCount == 1, "Removed directory source restored access signal")
Auth.auth().setUser(nil); await consumer.value
require(!inbox.isCurrent && sdk.listenerCount == 0 && Auth.auth().listenerCount == 0, "Inbox retained identity/index/source registrations")
print("RideChatAdapterRuntimeChecks passed: \(groups) actual thread adapter invalidations plus inbox source removal; cache/pending rejection, current-set authority, late callbacks and idempotent listener/auth cleanup; scripted SDK only, no SDK binary/provider/phone")
