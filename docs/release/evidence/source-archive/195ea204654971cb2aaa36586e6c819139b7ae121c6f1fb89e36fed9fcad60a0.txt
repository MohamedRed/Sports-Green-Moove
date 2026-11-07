import Foundation

@MainActor func checkGuardianContactSelection() async throws {
    var rejected = 0
    func rejects(_ action: () throws -> Void) {
        do { try action(); fatalError("Invalid guardian contact page accepted") } catch { rejected += 1 }
    }
    let row: [String: Any] = ["id": String(repeating: "a", count: 64), "parentUserId": "isolated-parent", "childId": "child",
        "clubId": "club", "childName": "Enfant fictif", "clubName": "Club fictif", "status": "verified", "revision": 1,
        "allowedActions": ["withdraw"]]
    let decoded = try GuardianContactWire.page(["items": [row], "nextCursor": NSNull()], uid: "isolated-parent")
    check(decoded.items[0].selectable, "Verified parent target was not selectable")
    for token in ["", "unsafe=", "unsafe\n", String(repeating: "a", count: 16_385), "é"] {
        check(!GuardianContactWire.validCursor(token), "Malformed guardian cursor accepted")
    }
    let invalid: [[String: Any]] = [["parentUserId": "other"], ["id": "fake"], ["revision": true], ["revision": 0],
        ["status": "approved"], ["allowedActions": ["verify"]], ["allowedActions": ["withdraw", "withdraw"]],
        ["childName": ""], ["clubName": "\u{202e}Club"], ["childId": "../child"]]
    for change in invalid {
        rejects { _ = try GuardianContactWire.page(["items": [row.merging(change) { _, new in new }], "nextCursor": NSNull()], uid: "isolated-parent") }
    }
    rejects { _ = try GuardianContactWire.page(["items": [row]], uid: "isolated-parent") }
    rejects { _ = try GuardianContactWire.page(["items": [row, row], "nextCursor": NSNull()], uid: "isolated-parent") }
    rejects { _ = try GuardianContactWire.page(["items": [], "nextCursor": "next"], uid: "isolated-parent") }
    rejects { _ = try GuardianContactWire.page(["items": Array(repeating: row, count: 21), "nextCursor": NSNull()], uid: "isolated-parent") }
    let (account, access) = emergencyAccess()
    let first = (1...20).map { isolatedGuardianContact($0, status: .refused) }
    let verified = isolatedGuardianContact(21), redacted = isolatedGuardianContact(22, childName: nil)
    let gateway = GuardianContactProbe(pages: ["first": .init(items: first, nextCursor: "next"), "next": .init(items: [verified, redacted], nextCursor: nil)])
    let state = GuardianContactState(access: access, gateway: gateway)
    await state.more(); let beforeInitialRead = await gateway.count()
    check(beforeInitialRead == 0, "Pagination invented its initial cursor")
    await state.refresh(); check(state.loaded && state.choices.isEmpty && state.hasMore, "Nonverified first page hid continuation or offered a child")
    check(state.select(first[0]) == nil, "A refused relationship became a selectable child")
    await state.more(); check(state.items.count == 22 && state.choices.count == 2 && !state.hasMore, "Verified history beyond twenty was truncated")
    check(state.select(redacted) == nil, "A redacted child was replaced with an invented identity")
    check(state.select(verified) == verified.target && state.items.isEmpty && !state.loaded, "Selection did not pin the exact current club/child and clear private rows")
    await state.refresh(); let afterSelection = await gateway.count()
    check(afterSelection == 2, "Closed picker read after selecting a target")
    check(!account.busy, "Picker retained a settled account lease")
    await checkGuardianContactPageFailures(access: access)
    await checkGuardianContactBoundaries()
    try await checkParentEmergencyContactEditor()
    print("GuardianContactChecks passed: \(rejected) malformed page cases, strict cursors, twenty-row continuation, verified-only targets, redaction and exact selection; controlled gateways only")
}

@MainActor private func checkGuardianContactPageFailures(access: AccountAccess) async {
    for failure in ["duplicate-id", "duplicate-target", "repeated-cursor", "cursor-cycle", "foreign-parent"] {
        let row = isolatedGuardianContact(1), other = isolatedGuardianContact(2)
        var second = GuardianContactPage(items: [other], nextCursor: nil)
        if failure == "duplicate-id" { second = .init(items: [row], nextCursor: nil) }
        if failure == "duplicate-target" {
            second = .init(items: [GuardianContactRecord(id: other.id, parentUserId: row.parentUserId, childId: row.childId,
                clubId: row.clubId, childName: row.childName, clubName: row.clubName, status: .verified, revision: 1, allowedActions: ["withdraw"])], nextCursor: nil)
        }
        if failure == "repeated-cursor" { second = .init(items: [other], nextCursor: "next") }
        if failure == "cursor-cycle" { second = .init(items: [other], nextCursor: "third") }
        if failure == "foreign-parent" { second = .init(items: [isolatedGuardianContact(2, uid: "other-parent")], nextCursor: nil) }
        let gateway = GuardianContactProbe(pages: ["first": .init(items: [row], nextCursor: "next"), "next": second,
            "third": .init(items: [isolatedGuardianContact(3)], nextCursor: "next")])
        let state = GuardianContactState(access: access, gateway: gateway)
        await state.refresh(); await state.more(); if failure == "cursor-cycle" { await state.more() }
        check(state.items.isEmpty && !state.loaded && state.error != nil && !state.hasMore && state.select(row) == nil,
            "Failed guardian page retained private selectable rows or advanced a bad cursor")
        await gateway.configure(["first": .init(items: [row], nextCursor: nil)])
        await state.refresh(); check(state.loaded && state.choices == [row], "Explicit guardian list retry did not recover")
        state.close()
    }
    for role in [AppRole.child, .driver, .clubManager, .admin] {
        let (_, denied) = emergencyAccess(uid: "denied-role", roles: [role])
        let gateway = GuardianContactProbe(pages: [:]); let state = GuardianContactState(access: denied, gateway: gateway)
        await state.refresh(); let calls = await gateway.count()
        check(calls == 0 && state.personal() == nil, "A nonparent accessed the verified-child picker")
        state.close()
    }
}
