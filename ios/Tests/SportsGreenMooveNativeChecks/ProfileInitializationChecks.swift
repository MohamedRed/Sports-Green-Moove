import Foundation

@MainActor
func checkProfileInitialization() async throws {
    func payload(_ roles: [String] = ["parent"]) -> [String: Any] {
        ["userId": "isolated-profile", "displayName": "Nom QA", "email": "qa@example.invalid",
         "roleKeys": roles, "roles": Dictionary(uniqueKeysWithValues: AppRole.allCases.map { ($0.rawValue, roles.contains($0.rawValue)) })]
    }
    func rejected(_ data: [String: Any]) {
        do { _ = try InitializedProfileWire.session(expectedUid: "isolated-profile", payload: data) }
        catch { return }
        fatalError("Invalid initialized profile was accepted")
    }
    let accepted = try InitializedProfileWire.session(expectedUid: "isolated-profile", payload: payload(["parent", "driver"]))
    check(accepted.displayName == "Nom QA" && accepted.roles == [.parent, .driver], "Profile identity or roles were guessed")
    check(accepted.initials == "NQ", "Initials did not come from the actual profile")
    var unnamed = payload(); unnamed["displayName"] = NSNull()
    let withoutName = try InitializedProfileWire.session(expectedUid: "isolated-profile", payload: unnamed)
    check(withoutName.displayName == nil && withoutName.initials == nil, "Missing name invented a person's identity")
    for roles in [[], ["unknown"], ["parent", "parent"], ["child", "parent"], ["child", "admin"]] { rejected(payload(roles)) }
    for field in ["roleKeys", "roles", "userId"] { var data = payload(); data.removeValue(forKey: field); rejected(data) }
    for (field, value) in [("userId", "other" as Any), ("roleKeys", [1]), ("displayName", 12),
        ("roles", ["parent": true]), ("roles", ["parent": 1, "driver": 0, "child": 0, "clubManager": 0, "admin": 0])] {
        var data = payload(); data[field] = value; rejected(data)
    }
    let child = try InitializedProfileWire.session(expectedUid: "isolated-profile", payload: payload(["child"]))
    check(child.roles == [.child], "Child profile gained an inferred adult role")
    for roles in [[], ["unknown"], ["parent", "parent"], ["child", "driver"]] {
        do { _ = try InitializedProfileWire.roleKeys(roles); fatalError("Invalid refreshed claims were accepted") }
        catch { }
    }

    func make(_ auth: AuthenticationProbe, _ profiles: ProfileInitializationProbe, _ store: MemoryLogoutIntentStore) -> AppState {
        AppState(auth: auth, firebase: AppDataFixtureGateway(probe: AppDataProbe(), profiles: profiles),
            authentication: AuthenticationState(makeStore: { store }))
    }
    for fails in [false, true] {
        let auth = AuthenticationProbe(), profiles = ProfileInitializationProbe(), store = MemoryLogoutIntentStore()
        let app = make(auth, profiles, store)
        let login = Task { await app.signIn(email: "qa@example.invalid", password: "fixture-only") }
        await auth.waitForCall(1); auth.complete(1, uid: "isolated-profile")
        await profiles.waitForCall(1)
        check(app.session == nil && store.required && app.authenticating, "Raw identity opened the app before profile initialization")
        app.signOut()
        await app.signIn(email: "other@example.invalid", password: "fixture-only")
        check(auth.calls.count == 1, "New sign-in overlapped abandoned profile initialization")
        await profiles.complete(1, fails: fails); await login.value
        check(app.session == nil && auth.providerUid == nil && store.required && !app.authenticating,
            "Late profile success/error restored a signed-out account")
    }
    let auth = AuthenticationProbe(), profiles = ProfileInitializationProbe(), store = MemoryLogoutIntentStore()
    let app = make(auth, profiles, store)
    for name in [" ", "A", String(repeating: "N", count: 161)] {
        await app.signUp(name: name, email: "qa@example.invalid", password: "fixture-only")
    }
    check(auth.calls.isEmpty, "Invalid signup name created credentials before validation")
    let signup = Task { await app.signUp(name: "  Parent QA  ", email: "qa@example.invalid", password: "fixture-only") }
    await auth.waitForCall(1); auth.complete(1, uid: "isolated-profile")
    await profiles.waitForCall(1)
    let submittedNames = await profiles.names
    check(submittedNames == ["Parent QA"] && store.required, "Signup discarded the submitted name or committed too early")
    await profiles.complete(1, roles: [.child]); await signup.value
    check(app.session?.roles == [.child] && app.selectedRole == .child && !store.required,
        "Accepted child profile inherited an adult role or uncommitted identity")
    await app.selectAuthorizedRole(.driver)
    check(app.selectedRole == .child, "Child profile switched to a role not granted by the server")
    app.signOut()
    check(app.session == nil, "Profile identity survived logout")

    for (uid, roleSet): (String, [AppRole]) in [("isolated-profile", []), ("isolated-profile", [.parent, .parent]),
        ("isolated-profile", [.child, .driver]), ("other-account", [.parent])] {
        let badAuth = AuthenticationProbe(), badProfiles = ProfileInitializationProbe(), badStore = MemoryLogoutIntentStore()
        let bad = make(badAuth, badProfiles, badStore)
        let login = Task { await bad.signIn(email: "qa@example.invalid", password: "fixture-only") }
        await badAuth.waitForCall(1); badAuth.complete(1, uid: "isolated-profile")
        await badProfiles.waitForCall(1); await badProfiles.complete(1, uid: uid, roles: roleSet); await login.value
        check(bad.session == nil && badAuth.providerUid == nil && badStore.required, "Invalid role profile was committed")
    }
    let staleAuth = AuthenticationProbe(), untouchedProfiles = ProfileInitializationProbe(), staleStore = MemoryLogoutIntentStore()
    let stale = make(staleAuth, untouchedProfiles, staleStore)
    let abandoned = Task { await stale.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await staleAuth.waitForCall(1); stale.signOut(); staleAuth.complete(1, uid: "isolated-profile"); await abandoned.value
    let names = await untouchedProfiles.names
    check(names.isEmpty, "Abandoned raw sign-in triggered a later profile write")

    let retryAuth = AuthenticationProbe(), retryProfiles = ProfileInitializationProbe(), retryStore = MemoryLogoutIntentStore()
    let retryApp = make(retryAuth, retryProfiles, retryStore)
    let failed = Task { await retryApp.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await retryAuth.waitForCall(1); retryAuth.complete(1, uid: "isolated-profile")
    await retryProfiles.waitForCall(1); await retryProfiles.complete(1, fails: true); await failed.value
    check(retryApp.session == nil && retryAuth.providerUid == nil && retryStore.required &&
        retryApp.errorMessage == AuthenticationCopy.preparation,
        "Current profile failure retained raw credentials")
    let retried = Task { await retryApp.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await retryAuth.waitForCall(2); retryAuth.complete(2, uid: "isolated-profile")
    await retryProfiles.waitForCall(2); await retryProfiles.complete(2); await retried.value
    check(retryApp.session?.displayName == "Isolated parent" && !retryStore.required && retryApp.errorMessage == nil,
        "Explicit retry could not recover profile preparation without creating another account")

    let cancelAuth = AuthenticationProbe(), cancelProfiles = ProfileInitializationProbe(), cancelStore = MemoryLogoutIntentStore()
    let cancelApp = make(cancelAuth, cancelProfiles, cancelStore)
    let cancelled = Task { await cancelApp.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await cancelAuth.waitForCall(1); cancelAuth.complete(1, uid: "isolated-profile")
    await cancelProfiles.waitForCall(1); cancelled.cancel(); await cancelProfiles.complete(1); await cancelled.value
    check(cancelApp.session == nil && cancelAuth.providerUid == nil && cancelStore.required,
        "Cancellation during profile preparation left an accepted session")

    let restoreAuth = AuthenticationProbe(providerUid: "isolated-profile")
    let restoreProfiles = ProfileInitializationProbe(), restoreStore = MemoryLogoutIntentStore()
    let restored = make(restoreAuth, restoreProfiles, restoreStore)
    let brokenRestore = Task { await restored.bootstrap() }
    await restoreAuth.waitForCall(1); restoreAuth.complete(1, uid: "isolated-profile")
    await restoreProfiles.waitForCall(1); await restoreProfiles.complete(1, fails: true); await brokenRestore.value
    check(restored.session == nil && restored.authenticationRestoreFailed && restoreAuth.providerUid == "isolated-profile",
        "Temporary restore preparation failure lost its explicit retry path")
    let restoreRetry = Task { await restored.bootstrap() }
    await restoreAuth.waitForCall(2); restoreAuth.complete(2, uid: "isolated-profile")
    await restoreProfiles.waitForCall(2); await restoreProfiles.complete(2); await restoreRetry.value
    check(restored.session?.uid == "isolated-profile" && !restored.authenticationRestoreFailed,
        "Explicit restore retry did not load the validated profile")
    print("Profile initialization checks passed: strict identity/roles, child-only authority, signup name, delayed preparation cleanup and authorized role selection; isolated gateways only")
}
