import Foundation

@MainActor func checkChildAccountStates() async throws {
    let (_, access) = emergencyAccess(), target = try isolatedChildTarget(), probe = ChildAccountProbe()
    let selected = EmergencyContactView(ownerUid: access.context.uid, scope: .managed(.child(childId: target.childId, clubId: target.clubId)),
        contact: nil, revision: 0, childId: target.childId, childInstanceId: target.childInstanceId,
        childName: target.childName, clubName: "Club fictif")
    let firstPresentation = try ChildAccountPresentation(access: access, view: selected)
    let secondPresentation = try ChildAccountPresentation(access: access, view: selected)
    check(firstPresentation.target == target && secondPresentation.target == target && firstPresentation.id != secondPresentation.id,
        "Parent presentation lost its immutable target or reused a previous view state")
    check((try? ChildAccountPresentation(access: access, view: nil)) == nil, "Parent opened an empty child presentation")
    let (_, pureChild) = emergencyAccess(uid: "child-login", roles: [.child])
    let childPresentation = try ChildAccountPresentation(access: pureChild, view: nil)
    check(childPresentation.target == nil, "Child code presentation gained a parent target")
    check((try? ChildAccountPresentation(access: pureChild, view: selected)) == nil, "Child gained a parent presentation")
    for roles: [AppRole] in [[.driver], [.clubManager]] {
        let (_, denied) = emergencyAccess(roles: roles)
        check((try? ChildAccountPresentation(access: denied, view: selected)) == nil, "Non-parent opened a child invitation")
        check((try? ChildAccountPresentation(access: denied, view: nil)) == nil, "Non-child opened a code presentation")
    }
    let (obsoleteScope, obsolete) = emergencyAccess(); obsoleteScope.clear()
    check((try? ChildAccountPresentation(access: obsolete, view: selected)) == nil, "Obsolete account opened a child presentation")
    let (_, foreignAccess) = emergencyAccess(uid: "foreign-parent")
    check((try? ChildAccountPresentation(access: foreignAccess, view: selected)) == nil, "Foreign parent opened another account's child target")
    print("ChildAccountPresentationChecks passed: immutable parent target, pure-child mode, fresh view identity, empty/foreign/role/obsolete-account denial; no screen rendering proof")
    let invitation = ChildInvitationState(access: access, target: target, gateway: probe, now: { isolatedChildNow })
    await invitation.create(); let initialCalls = await probe.calls
    check(initialCalls.isEmpty, "Invitation was created before authoritative status")
    await invitation.refresh(); check(invitation.loaded && invitation.current == nil && invitation.canCreate && invitation.sharingURL() == nil, "Empty invitation did not stay secret-free")
    await invitation.create(); check(invitation.sharingURL() != nil, "Validated invitation cannot be shared")
    await invitation.refresh(); check(invitation.sharingURL() == nil && invitation.current?.status == .pending, "Status refresh reconstructed the invitation secret")
    await invitation.revoke(); check(invitation.current?.status == .revoked && invitation.sharingURL() == nil, "Revocation left a shareable URL")
    await probe.configure(loseCreateReply: true); await invitation.create()
    check(!invitation.loaded && !invitation.canCreate && invitation.error != nil && invitation.sharingURL() == nil, "Lost create reply permitted optimistic sharing or replacement")
    await invitation.refresh(); check(invitation.loaded && invitation.sharingURL() == nil, "Lost secret reconstructed after refresh")
    for status in [ChildInvitationStatus.provisioning, .accepted] {
        await probe.configure(ChildInvitationSummary(invitationHash: String(repeating: "d", count: 64), status: status, expiresAtMillis: isolatedChildNow + 1000))
        await invitation.refresh(); let before = await probe.calls.count
        await invitation.create(); await invitation.revoke(); let after = await probe.calls.count
        check(before == after && !invitation.canCreate && !invitation.canRevoke, "Claimed signup was replaced or revoked")
    }
    invitation.suspend(); await invitation.create(); check(invitation.current == nil && invitation.sharingURL() == nil, "Background invitation retained data")
    let childScope = emergencyAccess(uid: "child-login", roles: [.child]).0
    let child = ChildAccountState(access: childScope.access!, target: nil, gateway: probe, now: { isolatedChildNow })
    await child.create(); check(child.activeCode?.code == isolatedChildCode && !child.canApprove, "Child cannot create a bound code or gained parent approval")
    let expired = ChildAccountState(access: childScope.access!, target: nil, gateway: probe, now: { isolatedChildNow + 600_000 })
    await expired.create(); check(expired.activeCode == nil && expired.error != nil, "Expired code was displayed")
    child.suspend(); check(child.code == nil && child.input.isEmpty, "Background retained child code")
    let parent = ChildAccountState(access: access, target: target, gateway: probe, now: { isolatedChildNow })
    parent.edit("short"); check(!parent.canApprove, "Short approval code allowed")
    parent.edit(" CCCCCCCC CCCCCCCC CCCCCCCC CCCCCCCC "); check(parent.canApprove, "Canonical code entry rejected")
    await parent.approve(); check(parent.approved && parent.input.isEmpty && !parent.canApprove, "Exact parent approval not retained or input not cleared")
    parent.suspend(); check(!parent.approved && parent.input.isEmpty, "Background retained approval result")
    check(!AuthSession(uid: "mixed", email: nil, displayName: nil, roles: [.parent, .child]).isValid, "Mixed child/adult roles gained an account scope")
    for roles: [AppRole] in [[.clubManager], [.driver], [.child]] {
        let (_, forbidden) = emergencyAccess(roles: roles), denied = ChildAccountState(access: forbidden, target: target, gateway: probe)
        denied.edit(isolatedChildCode); let before = await probe.calls.count; await denied.approve(); await denied.create()
        let deniedInvitation = ChildInvitationState(access: forbidden, target: target, gateway: probe)
        await deniedInvitation.refresh(); await deniedInvitation.create(); let after = await probe.calls.count
        check(before == after && !denied.approved, "Manager, driver or mixed child role gained parent authority")
    }
    print("ChildAccountStateChecks passed: explicit invitation create/share/revoke, claimed/unknown-write guards, memory-only background disposal, child code expiry and verified-parent-only approval")
}
