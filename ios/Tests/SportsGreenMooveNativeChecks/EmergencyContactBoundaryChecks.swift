import Foundation

@MainActor func checkEmergencyContactBoundaries() async {
    var completed = 0
    for action in ["read", "save", "dial"] {
        for failing in [false, true] {
            for revocation in ["same-uid", "other-uid", "role-roundtrip", "close", "background", "cancel"] {
                let (account, access) = emergencyAccess()
                let gateway = EmergencyContactProbe(value: isolatedEmergencyView(contact: isolatedContact, revision: 1))
                let state = EmergencyContactState(access: access, scope: .managed(.personal), gateway: gateway)
                let phone = EmergencyPhoneProbe()
                if action != "read" { await state.refresh() }
                if action == "save" { state.name = "Edited contact"; state.phone = "+32470000002"; state.reviewSave() }
                let held = await gateway.holdNext()
                let task = Task {
                    switch action {
                    case "read": await state.refresh()
                    case "save": await state.confirmSave()
                    default: await state.dial(using: phone)
                    }
                }
                await gateway.waitForCall(held)
                check(account.busy, "Contact boundary was not bound to unsettled account work")
                if revocation == "close" { state.close() }
                else if revocation == "background" { state.suspend() }
                else if revocation == "cancel" { task.cancel() }
                else {
                    let roles: [AppRole] = [.parent, .driver]
                    if revocation == "role-roundtrip" {
                        account.replace(session: AuthSession(uid: "isolated-parent", email: nil, displayName: nil, roles: roles), role: .driver)
                    }
                    account.replace(session: AuthSession(uid: revocation == "other-uid" ? "other-parent" : "isolated-parent",
                        email: nil, displayName: nil, roles: roles), role: .parent)
                    check(account.access?.begin() == nil, "Another account admitted contact work before the old operation settled")
                }
                await gateway.release(held, failing: failing); await task.value
                let calls = await gateway.names()
                check(calls.count == held, "Revoked contact operation started a follow-up read")
                check(state.view == nil && state.name.isEmpty && state.phone.isEmpty && state.error == nil && state.notice == nil,
                    "Revoked contact response or private fields returned after disposal/cancellation/account change")
                check(phone.contacts.isEmpty && !state.busy && !account.busy, "Revoked contact opened the phone or retained busy admission")
                completed += 1
            }
        }
    }
    print("EmergencyContactBoundaryChecks passed: \(completed) delayed read/write/dial success/error boundaries; same-UID, account/role ABA, background, close and cancellation")
    await checkEmergencyPhoneCompletionBoundaries()
}

@MainActor private func checkEmergencyPhoneCompletionBoundaries() async {
    for revoke in ["same-uid", "other-uid", "role", "close", "background", "cancel"] {
        let (account, access) = emergencyAccess()
        let gateway = EmergencyContactProbe(value: isolatedEmergencyView(contact: isolatedContact, revision: 1))
        let state = EmergencyContactState(access: access, scope: .managed(.personal), gateway: gateway)
        let phone = EmergencyPhoneProbe(); phone.hold = true
        await state.refresh()
        let task = Task { await state.dial(using: phone) }; await phone.waitForOpen()
        if revoke == "close" { state.close() }
        else if revoke == "background" { state.suspend() }
        else if revoke == "cancel" { task.cancel() }
        else {
            account.replace(session: AuthSession(uid: revoke == "other-uid" ? "other-parent" : "isolated-parent",
                email: nil, displayName: nil, roles: [.parent, .driver]), role: revoke == "role" ? .driver : .parent)
        }
        phone.release(); await task.value
        check(state.view == nil && state.notice == nil && state.error == nil && state.name.isEmpty && state.phone.isEmpty,
            "Delayed phone completion restored private data or feedback")
        check(phone.contacts.count == 1 && !state.busy && !account.busy, "Phone completion retried an opening or retained account admission")
    }
    print("EmergencyPhoneCompletionChecks passed: 6 late controlled opener callbacks; no actual URL opened or call placed")
}
