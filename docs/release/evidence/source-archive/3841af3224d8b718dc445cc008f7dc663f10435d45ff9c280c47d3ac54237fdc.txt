import Foundation

@MainActor func checkTeamChatStorage() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-team-storage-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = TeamChatDraftStore(directory: root)
    let editable = TeamChatDraft(uid: "parent", target: isolatedTeamTarget, body: "Private draft", requestId: nil)
    try store.write(editable)
    let initial = try store.read(uid: "parent", target: isolatedTeamTarget)
    let foreign = try TeamChatDraftStore(directory: root).read(uid: "other", target: isolatedTeamTarget)
    check(initial == editable, "Draft write did not survive store recreation")
    check(foreign == nil, "Another account read a team draft")
    let recreated = TeamChatTarget(teamId: isolatedTeamTarget.teamId, instanceId: String(repeating: "c", count: 64))
    let replacement = try store.read(uid: "parent", target: recreated)
    check(replacement == nil, "Recreated team inherited a former draft")
    let pending = TeamChatDraft(uid: editable.uid, target: editable.target, body: editable.body, requestId: UUID())
    try store.write(pending)
    for replacement in [editable, .init(uid: "parent", target: isolatedTeamTarget, body: "Changed", requestId: pending.requestId)] {
        do { try store.write(replacement); fatalError("Unconfirmed team intent was replaced") } catch { }
    }
    do { try store.remove(editable); fatalError("Unrelated draft acknowledgement erased a pending intent") } catch { }
    try store.releaseRejected(pending)
    let released = try store.read(uid: "parent", target: isolatedTeamTarget)
    check(released == editable, "Atomic rejection release lost the editable body")
    try store.write(pending); try store.remove(pending)
    let removed = try store.read(uid: "parent", target: isolatedTeamTarget)
    check(removed == nil, "Confirmed exact draft was not removed")
    try store.write(editable)
    let files = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
    guard let file = files.first else { fatalError("Isolated team draft file is missing") }
    try Data("not-json".utf8).write(to: file, options: .atomic)
    do { _ = try store.read(uid: "parent", target: isolatedTeamTarget); fatalError("Corrupt team storage was accepted") } catch { }
    let composer = TeamChatComposer(uid: "parent", target: isolatedTeamTarget, makeStorage: { store })
    composer.load()
    check(!composer.loaded && composer.body.isEmpty && composer.error != nil, "Corrupt storage silently became an empty usable draft")
    try Data(repeating: 65, count: 131_073).write(to: file, options: .atomic)
    do { _ = try store.read(uid: "parent", target: isolatedTeamTarget); fatalError("Oversized team storage was read") } catch { }
    await checkTeamAdmissionChanges(directory: root.appendingPathComponent("admission"))
    print("TeamChatStorageChecks passed: account/team-instance file isolation, store recreation, immutable pending writes, atomic rejected release, exact acknowledgement, corrupt/oversized denial and no volatile fallback")
}

@MainActor private func checkTeamAdmissionChanges(directory: URL) async {
    let storage = TeamChatStorageProbe(directory: directory), gateway = TeamChatProbe(), scope = isolatedTeamScope()
    let state = TeamChatState(access: scope.access!, target: isolatedTeamTarget, gateway: gateway, makeStorage: { storage })
    await gateway.configure(page: isolatedTeamPage(version: "bad")); await state.refresh()
    check(state.error != nil && storage.reads == 0, "Unverified admission opened private cached text")
    await gateway.configure(page: isolatedTeamPage(cursor: "older")); await state.refresh(); state.edit("Private admission draft")
    await gateway.configure(page: isolatedTeamPage([isolatedTeamMessage(1)])); await state.earlier()
    check(state.messages.count == 2, "Admission test did not retain its first older page")
    let changedVersion = String(repeating: "c", count: 64)
    await gateway.configure(page: isolatedTeamPage([isolatedTeamMessage(3)], version: changedVersion)); await state.refresh()
    check(state.messages.map(\.sequence) == [3], "Fresh admission retained old private history")
    await gateway.configure(page: isolatedTeamPage([isolatedTeamMessage(4)], cursor: "next", version: changedVersion)); await state.refresh()
    await gateway.configure(page: isolatedTeamPage([isolatedTeamMessage(2)])); await state.earlier()
    check(state.error != nil && state.messages.isEmpty && state.composer.body.isEmpty, "Changed admission during pagination retained stale content")
    let mixed = isolatedTeamScope(roles: [.parent, .child])
    check(mixed.access == nil, "A mixed child/adult account obtained an authenticated team-chat scope")
    print("Team admission checks passed: storage gated by fresh authority, full history replacement on admission change, earlier-page version rejection and mixed child-role denial")
}
