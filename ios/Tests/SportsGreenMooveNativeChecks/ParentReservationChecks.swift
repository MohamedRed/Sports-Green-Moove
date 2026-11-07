import Foundation

func parentReservationRow(_ id: String = "booking-1", uid: String = "parent", status: String = "requested", cancel: Bool = true) -> [String: Any] {
    ["bookingId": id, "tripId": "trip", "parentUserId": uid, "childLabel": "Child", "seats": 2,
     "status": status, "title": "Ride", "club": "Club", "dateLabel": "Tomorrow", "timeLabel": "12h00",
     "priceLabel": "4 EUR", "allowedActions": cancel ? ["cancel"] : [], "refundPending": false, "tripChangeId": NSNull()]
}

@MainActor func checkParentReservations() async throws {
    let raw = parentReservationRow()
    let page = try ParentReservationWire.page(["items": [raw], "nextCursor": NSNull()], uid: "parent")
    check(page.items.count == 1 && page.items[0].canCancel && page.items[0].seats == 2, "Valid owned reservation page was rejected")
    var rejected = 0
    for (key, value): (String, Any) in [
        ("parentUserId", "other"), ("bookingId", "../foreign"), ("tripId", "."), ("seats", true), ("seats", 1.5), ("seats", 0),
        ("status", "pending"), ("status", "cancelled"), ("allowedActions", ["approve"]), ("allowedActions", ["cancel", "cancel"]),
        ("title", ""), ("refundPending", 1), ("tripChangeId", "bad"), ("childLabel", 1), ("priceLabel", NSNull())] {
        var row = raw; row[key] = value
        do { _ = try ParentReservationWire.page(["items": [row], "nextCursor": NSNull()], uid: "parent"); fatalError("Malformed reservation accepted: \(key)") }
        catch { rejected += 1 }
    }
    for value: Any in [["items": [raw]], ["items": [raw, raw], "nextCursor": NSNull()],
                       ["items": [raw], "nextCursor": ""], ["items": Array(repeating: raw, count: 21), "nextCursor": NSNull()]] {
        do { _ = try ParentReservationWire.page(value, uid: "parent"); fatalError("Malformed reservation page accepted") }
        catch { rejected += 1 }
    }
    for value: Any in [["bookingId": "other", "status": "cancelled"], ["bookingId": "booking-1", "status": "approved"]] {
        do { _ = try ParentReservationWire.receipt(value, bookingId: "booking-1"); fatalError("Foreign cancellation receipt accepted") }
        catch { rejected += 1 }
    }
    try await checkParentReservationState(page.items[0])
    print("Parent reservation checks passed: \(rejected) malformed responses; owned paging, cancellation recovery and stale boundaries; synthetic gateways only")
}

actor ParentReservationProbe: ParentReservationGateway {
    var replies: [ParentReservationPage]
    var calls: [String] = []
    var suspended = false
    var continuation: CheckedContinuation<Void, Never>?
    var failing = false
    init(_ replies: [ParentReservationPage]) { self.replies = replies }
    func configure(suspended: Bool = false, failing: Bool = false) { self.suspended = suspended; self.failing = failing }
    func release() { continuation?.resume(); continuation = nil }
    func waitForSuspension() async { while continuation == nil { await Task.yield() } }
    private func pause() async throws {
        if suspended { await withCheckedContinuation { continuation = $0 } }
        if failing { throw ParentReservationError.unavailable }
    }
    func parentReservations(uid: String, cursor: String?) async throws -> ParentReservationPage {
        check(uid == "parent", "Reservation request changed its captured owner")
        calls.append("list:" + (cursor ?? "first")); try await pause()
        guard !replies.isEmpty else { throw ParentReservationError.unavailable }; return replies.removeFirst()
    }
    func cancelParentReservation(uid: String, bookingId: String) async throws -> ParentCancellationReceipt {
        check(uid == "parent" && bookingId == "booking-1", "Cancellation changed its captured target")
        calls.append("cancel"); try await pause(); return .init(bookingId: bookingId)
    }
}

@MainActor private func checkParentReservationState(_ row: ParentReservation) async throws {
    func scope() -> AccountWorkScope {
        let value = AccountWorkScope(); value.replace(session: AuthSession(uid: "parent", email: nil, displayName: nil, roles: [.parent, .driver]), role: .parent)
        return value
    }
    let own = scope(), probe = ParentReservationProbe([
        .init(userId: "parent", items: [], cursor: "second"), .init(userId: "parent", items: [row], cursor: nil),
        .init(userId: "parent", items: [], cursor: nil)])
    let state = ParentReservationState(access: own.access!, gateway: probe)
    await state.refresh(); check(state.loaded && state.items.isEmpty && state.hasMore, "Filtered empty page lost its continuation")
    await state.more(); check(state.items == [row] && !state.hasMore && state.canCancel(row), "Owned reservation was not loaded beyond the first page")
    await state.cancel(row); check(state.confirmation?.bookingId == row.id && state.requiresRefresh && !state.canCancel(row), "Proven cancellation was lost or can be sent twice")
    await state.cancel(row)
    await probe.configure(failing: true); await state.refresh()
    check(state.confirmation != nil && state.error != nil && state.requiresRefresh, "Failed refresh erased a confirmed cancellation")
    await probe.configure(); await state.refresh()
    check(state.confirmation != nil && state.loaded && !state.requiresRefresh && state.items.isEmpty, "Explicit read did not retain confirmation")
    let calls = await probe.calls; check(calls.filter { $0 == "cancel" }.count == 1 && !own.busy, "Cancellation was retried or leaked account work")
    for operation in ["read", "cancel"] {
        for boundary in ["signout", "other-account", "same-account", "role-roundtrip", "suspend", "task-cancel"] {
            let owner = scope(), original = owner.access!, gateway = ParentReservationProbe([.init(userId: "parent", items: [row], cursor: nil)])
            let view = ParentReservationState(access: original, gateway: gateway)
            if operation == "cancel" { await view.refresh() }
            await gateway.configure(suspended: true)
            let task = Task { if operation == "read" { await view.refresh() } else { await view.cancel(row) } }
            await gateway.waitForSuspension()
            switch boundary {
            case "signout": owner.clear()
            case "other-account": owner.replace(session: AuthSession(uid: "other", email: nil, displayName: nil, roles: [.parent]), role: .parent)
            case "same-account": owner.clear(); owner.replace(session: AuthSession(uid: "parent", email: nil, displayName: nil, roles: [.parent]), role: .parent)
            case "role-roundtrip":
                let session = AuthSession(uid: "parent", email: nil, displayName: nil, roles: [.parent, .driver])
                owner.replace(session: session, role: .driver); owner.replace(session: session, role: .parent)
            case "suspend": view.suspend()
            default: task.cancel()
            }
            await gateway.release(); await task.value
            check(view.confirmation == nil && view.error == nil && !owner.busy, "Late reservation reply crossed a stale boundary")
            if operation == "read" { check(view.items.isEmpty && !view.loaded, "Late read restored private reservations") }
        }
    }
    let uncertainOwner = scope(), uncertainProbe = ParentReservationProbe([.init(userId: "parent", items: [row], cursor: nil)])
    let uncertain = ParentReservationState(access: uncertainOwner.access!, gateway: uncertainProbe)
    await uncertain.refresh(); await uncertainProbe.configure(failing: true); await uncertain.cancel(row); await uncertain.cancel(row)
    let unknownCalls = await uncertainProbe.calls
    check(uncertain.confirmation == nil && uncertain.items.isEmpty && uncertain.requiresRefresh && uncertain.error != nil,
        "Unknown cancellation reply became success or left actions available")
    check(unknownCalls.filter { $0 == "cancel" }.count == 1, "Unknown cancellation was resent without an explicit read")
    for bad in ["foreign-page", "duplicate-row", "same-cursor", "cursor-cycle"] {
        let owner = scope()
        let second = ParentReservationPage(userId: bad == "foreign-page" ? "other" : "parent",
            items: bad == "duplicate-row" ? [row] : [], cursor: bad == "same-cursor" ? "next" : bad == "cursor-cycle" ? "third" : nil)
        let gateway = ParentReservationProbe([.init(userId: "parent", items: [row], cursor: "next"), second,
            .init(userId: "parent", items: [], cursor: "next")])
        let view = ParentReservationState(access: owner.access!, gateway: gateway)
        await view.refresh(); await view.more()
        if bad == "cursor-cycle" { await view.more() }
        check(view.error != nil && view.items.isEmpty && view.requiresRefresh && !view.canCancel(row), "Unsafe paging left actionable reservations")
    }
    for role: AppRole in [.driver, .child, .clubManager] {
        let owner = AccountWorkScope()
        owner.replace(session: AuthSession(uid: "parent", email: nil, displayName: nil, roles: [role]), role: role)
        let gateway = ParentReservationProbe([]), view = ParentReservationState(access: owner.access!, gateway: gateway)
        await view.refresh(); await view.cancel(row)
        let deniedCalls = await gateway.calls
        check(deniedCalls.isEmpty && !view.live && !owner.busy, "A non-parent fetched or cancelled a parent's reservations")
    }
}
