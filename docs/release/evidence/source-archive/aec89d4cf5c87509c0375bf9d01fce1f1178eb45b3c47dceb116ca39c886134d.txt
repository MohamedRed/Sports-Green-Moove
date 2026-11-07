import Foundation

@MainActor func checkRideChatStorage() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-ride-draft-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = RideChatDraftStore(directory: root), uid = rideChatOwner, ref = rideChatReference
    let body = "Brouillon exact e\u{301}", draft = RideChatDraft(uid: uid, reference: ref, body: body, requestId: nil)
    try store.write(draft)
    let restored = try RideChatDraftStore(directory: root).read(uid: uid, reference: ref)
    check(restored == draft, "Draft did not survive storage recreation")
    let otherUid = try RideChatID("other"), otherKind = RideChatReference(kind: .rideSession, sourceId: ref.sourceId)
    let foreignOwner = try store.read(uid: otherUid, reference: ref), foreignKind = try store.read(uid: uid, reference: otherKind)
    check(foreignOwner == nil && foreignKind == nil, "Draft crossed account/source-kind boundary")
    let pending = RideChatDraft(uid: uid, reference: ref, body: body, requestId: UUID())
    try store.write(pending); try store.write(pending)
    rideChatReject("pending replacement") { try store.write(draft) }
    rideChatReject("foreign acknowledgement") { try store.remove(draft) }
    let canonicalAlias = RideChatDraft(uid: uid, reference: ref, body: "Brouillon exact é", requestId: pending.requestId)
    rideChatReject("nonexact body acknowledgement") { try store.remove(canonicalAlias) }
    try store.releaseRejected(pending)
    try checkRideChatCondition(store.read(uid: uid, reference: ref) == draft, "Definitive rejection did not retain exact draft")
    try store.write(pending); try store.remove(pending)
    try checkRideChatCondition(store.read(uid: uid, reference: ref) == nil, "Matching receipt failed to remove draft")
    let composer = RideChatComposer(uid: uid, reference: ref, makeStorage: { store })
    composer.load(); composer.edit("  Exact retry message  ")
    let first = composer.prepare()!
    composer.failed(first.draft, rejected: false, retrying: first.retrying)
    composer.edit("must not replace unknown write")
    check(composer.body == "  Exact retry message  " && composer.prepare()?.draft.requestId == first.draft.requestId,
        "Unknown send changed its body or operation UUID")
    composer.clear(); composer.load()
    check(composer.pending == first.draft, "Pending send did not survive view recreation")
    composer.failed(first.draft, rejected: true, retrying: true)
    check(composer.pending != nil, "Rejected retry erased earlier uncertain write")
    let request = first.draft.requestId!
    try composer.reconcile([rideChatRow(1, sender: uid, body: "Exact retry message", request: request)])
    check(composer.pending == nil && composer.body.isEmpty, "Exact readback did not reconcile committed send")
    composer.edit("new text")
    composer.acknowledge(first.draft)
    check(composer.body == "new text", "Late receipt erased a newer draft")
    let blocked = RideChatComposer(uid: uid, reference: otherKind, makeStorage: { throw RideChatError.storage })
    blocked.load(); blocked.edit("no volatile fallback")
    check(!blocked.loaded && blocked.prepare() == nil && blocked.error != nil, "Storage failure adopted volatile drafts")
    let file = try root.appendingPathComponent(ref.inboxId(uid: uid).value + ".json")
    try Data("invalid json".utf8).write(to: file)
    rideChatReject("corrupt draft") { _ = try store.read(uid: uid, reference: ref) }
    try Data(repeating: 65, count: 131_073).write(to: file)
    rideChatReject("oversized draft") { _ = try store.read(uid: uid, reference: ref) }
    try FileManager.default.removeItem(at: file)
    let outside = root.appendingPathComponent("outside.json"); try JSONEncoder().encode(draft).write(to: outside)
    try FileManager.default.createSymbolicLink(at: file, withDestinationURL: outside)
    rideChatReject("symlink draft") { _ = try store.read(uid: uid, reference: ref) }
    let linked = root.appendingPathComponent("linked")
    try FileManager.default.createSymbolicLink(at: linked, withDestinationURL: root)
    rideChatReject("symlink directory") { _ = try RideChatDraftStore(directory: linked).read(uid: uid, reference: ref) }
    print("RideChatStorageChecks passed: recreated/account/source-kind isolation, byte-exact acknowledgement, immutable pending UUID, lost-receipt reconciliation, late success, corrupt/oversized/symlink denial; no volatile fallback")
}
