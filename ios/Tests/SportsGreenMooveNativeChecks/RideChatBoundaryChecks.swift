import Foundation

@MainActor func checkRideChatBoundaries() async throws {
    var count = 0
    for operation in ["open", "earlier", "send", "read", "directory", "bookings"] {
        for failing in [false, true] {
            for revoke in ["background", "close", "logout", "same-uid", "other-uid", "role-roundtrip", "cancel"] {
                let root = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-ride-boundary-" + UUID().uuidString)
                defer { try? FileManager.default.removeItem(at: root) }
                let scope = rideChatScope(), probe = RideChatProbe()
                let state = rideChatState(scope, probe, directory: root)
                let directory = RideChatDirectoryState(uid: rideChatOwner, access: scope.access!, gateway: probe)
                let bookings = RideChatBookingState(uid: rideChatOwner, access: scope.access!, gateway: probe)
                let threadOperation = ["open", "earlier", "send", "read"].contains(operation)
                let run: Task<Void, Never>?
                if threadOperation && operation != "open" {
                    run = Task { await state.run() }
                    await rideChatEventually({ state.loaded }, "Boundary thread never opened")
                    state.edit("isolated pending text")
                } else { run = nil }
                probe.suspended = true
                let request = Task {
                    switch operation {
                    case "open": await state.run()
                    case "earlier": await state.earlier()
                    case "send": await state.send()
                    case "read": await state.markVisible([rideChatRow(51).id])
                    case "directory": await directory.run()
                    default: await bookings.run()
                    }
                }
                await rideChatEventually({ probe.reply != nil }, "Boundary request never started: \(operation)")
                let calls = probe.names
                check(scope.busy, "Boundary released unfinished SDK work")
                switch revoke {
                case "background": state.suspend(); directory.suspend(); bookings.suspend()
                case "close": state.close(); directory.close(); bookings.close()
                case "cancel": request.cancel(); run?.cancel()
                case "role-roundtrip": rideChatReplace(scope, role: .driver); rideChatReplace(scope)
                default:
                    scope.clear()
                    if revoke != "logout" { rideChatReplace(scope, uid: revoke == "same-uid" ? "parent" : "other") }
                }
                if ["same-uid", "other-uid", "role-roundtrip"].contains(revoke) {
                    check(scope.access!.begin() == nil, "New generation crossed unsettled callback")
                }
                if revoke != "cancel" && revoke != "background" && revoke != "close" {
                    probe.watch.publish(probe.page); probe.inbox.changed()
                }
                check(probe.names == calls && scope.busy, "Invalidation duplicated or prematurely drained work")
                probe.release(failing ? ProviderConfigurationError(message: "delayed isolated failure") : nil)
                if operation == "directory" {
                    await rideChatEventually({ !directory.busy }, "Directory callback never drained")
                    directory.suspend()
                }
                await request.value
                if let run { await run.value }
                state.close(); directory.close(); bookings.close()
                check(state.messages.isEmpty && state.composer.body.isEmpty && directory.items.isEmpty && bookings.items.isEmpty,
                    "Delayed callback restored private state")
                check(probe.names == calls && !scope.busy, "Boundary dispatched stale work or leaked ownership")
                count += 1
            }
        }
    }
    print("RideChatBoundaryChecks passed: \(count) delayed open/history/send/read/directory/booking success/error cases across lifecycle, account/role generations and cancellation; actual callback drainage")
}
