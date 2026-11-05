import Foundation

@MainActor func checkParentEmergencyContactEditor() async throws {
    let (_, access) = emergencyAccess()
    let target = EmergencyContactTarget.child(childId: "child-profile", clubId: "verified-club")
    let original = EmergencyContactView(ownerUid: "isolated-parent", scope: .managed(target), contact: nil, revision: 0,
        childId: "child-profile", childInstanceId: String(repeating: "a", count: 64), childName: "Enfant fictif", clubName: "Club vérificateur")
    let gateway = EmergencyContactProbe(value: original)
    let state = EmergencyContactState(access: access, scope: .managed(target), gateway: gateway)
    await state.refresh(); check(state.canEdit && state.view?.childName == original.childName, "Selected verified child did not use the actual scoped contact editor")
    state.name = isolatedContact.name; state.phone = isolatedContact.phone; state.reviewSave()
    let reviewed = state.pending!
    check(reviewed.target == target && reviewed.expectedChildInstanceId == original.childInstanceId, "Child write lost its selected club or immutable identity")
    let payload = try EmergencyContactWire.payload(reviewed)
    check(payload["expectedChildInstanceId"] as? String == original.childInstanceId, "Actual child wire did not carry its displayed immutable identity")
    await state.confirmSave(); check(state.view?.contact == isolatedContact && state.view?.revision == 1, "Reviewed child contact was not refreshed after saving")
    state.name = "Unsaved child contact"; state.suspend(); await state.resume()
    check(!state.dirty && state.name == isolatedContact.name, "Background retained an unfinished private child edit")
    let blocked = await gateway.holdNext()
    let read = Task { await state.refresh() }; await gateway.waitForCall(blocked)
    await gateway.release(blocked, failing: true); await read.value
    check(state.error != nil && state.view == nil && !state.canSave && !state.canDial, "Revoked or failed current authority retained an actionable child contact")
    await state.refresh()
    state.reviewSave(removing: true); await state.confirmSave()
    check(state.view?.contact == nil && state.view?.revision == 2, "Child removal did not retain the selected identity's null-contact revision")
    state.close()
    let manager = AccountWorkScope()
    manager.replace(session: AuthSession(uid: "manager", email: nil, displayName: nil, roles: [.clubManager, .parent]), role: .clubManager)
    let denied = EmergencyContactState(access: manager.access!, scope: .managed(target), gateway: gateway)
    let before = await gateway.names(); await denied.refresh(); denied.reviewSave(); await denied.confirmSave()
    let after = await gateway.names()
    check(!denied.canEdit && denied.view == nil && before == after, "Manager role implicitly obtained the parent's child-contact editor")
    denied.close()
    print("ParentEmergencyContactChecks passed: exact verified target, immutable child write, reviewed save/removal, private lifecycle, authority failure and manager-role denial; controlled gateway only")
}
