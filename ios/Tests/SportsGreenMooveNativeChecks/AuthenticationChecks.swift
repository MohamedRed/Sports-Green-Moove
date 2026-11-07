import Foundation

@MainActor
func makeAuthenticationApp(_ gateway: AuthenticationProbe, store: any LogoutIntentStore) -> AppState {
    AppState(auth: gateway, firebase: AppDataFixtureGateway(probe: AppDataProbe()),
        authentication: AuthenticationState(makeStore: { store }))
}

@MainActor
func checkAuthenticationOwnership() async {
    for method in ["signIn", "signUp", "google", "facebook"] {
        let gateway = AuthenticationProbe()
        let store = MemoryLogoutIntentStore()
        let app = makeAuthenticationApp(gateway, store: store)
        let request = Task {
            switch method {
            case "signUp": await app.signUp(name: "Isolated parent", email: "qa@example.invalid", password: "fixture-only")
            case "google": await app.signInWithGoogle()
            case "facebook": await app.signInWithFacebook()
            default: await app.signIn(email: "qa@example.invalid", password: "fixture-only")
            }
        }
        await gateway.waitForCall(1)
        check(store.required && app.authenticating, "Identity mutation began before its durable pending policy")
        app.loading = true
        app.signOut()
        check(app.session == nil && app.authenticating && store.required,
            "Logout did not close the app immediately while waiting for the old callback")
        app.errorMessage = "Current status"
        await app.signIn(email: "other@example.invalid", password: "fixture-only")
        check(gateway.calls == [method], "A new login overlapped an uncancelled provider request")
        gateway.complete(1, uid: "isolated-late-parent")
        check(gateway.providerUid != nil, "Probe did not model provider mutation before callback delivery")
        await request.value
        check(app.session == nil && gateway.providerUid == nil && gateway.signOutCalls == 2,
            "Late login restored either the visible session or the underlying provider identity")
        check(store.required && !app.authenticating && app.loading && app.errorMessage == "Current status",
            "Late login changed another operation's busy state or status, or erased logout intent")
    }

    let gateway = AuthenticationProbe()
    let store = MemoryLogoutIntentStore()
    let app = makeAuthenticationApp(gateway, store: store)
    let login = Task { await app.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await gateway.waitForCall(1)
    await app.bootstrap()
    await app.signUp(name: "Other", email: "other@example.invalid", password: "fixture-only")
    check(gateway.calls == ["signIn"], "Repeated login/signup/restore bypassed serialization")
    gateway.complete(1, uid: "isolated-current")
    await login.value
    check(app.session?.uid == "isolated-current" && gateway.providerUid == app.session?.uid &&
        !store.required && store.writes == [true, false], "Owned login did not commit its exact identity")
    await app.signIn(email: "other@example.invalid", password: "fixture-only")
    check(gateway.calls == ["signIn"], "An accepted session could be silently replaced without logout")

    let restoredGateway = AuthenticationProbe(providerUid: "isolated-cached")
    let restoredStore = MemoryLogoutIntentStore()
    let restored = makeAuthenticationApp(restoredGateway, store: restoredStore)
    let restoration = Task { await restored.bootstrap() }
    await restoredGateway.waitForCall(1)
    restored.signOut()
    restoredGateway.complete(1, uid: "isolated-cached")
    await restoration.value
    check(restored.session == nil && restoredGateway.providerUid == nil && restoredStore.required &&
        restoredGateway.signOutCalls == 1, "Late read-only restoration revived a signed-out account")

    for fails in [false, true] {
        let cancelledGateway = AuthenticationProbe()
        let cancelledStore = MemoryLogoutIntentStore()
        let cancelled = makeAuthenticationApp(cancelledGateway, store: cancelledStore)
        let pending = Task { await cancelled.signIn(email: "qa@example.invalid", password: "fixture-only") }
        await cancelledGateway.waitForCall(1)
        pending.cancel()
        cancelledGateway.complete(1, uid: "isolated-cancelled", fails: fails)
        await pending.value
        check(cancelled.session == nil && cancelledGateway.providerUid == nil && cancelledStore.required &&
            !cancelled.authenticating, "Cancellation left provider credentials or a resurrected session")
    }

    let failedGateway = AuthenticationProbe()
    let failedStore = MemoryLogoutIntentStore()
    let failed = makeAuthenticationApp(failedGateway, store: failedStore)
    let failure = Task { await failed.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await failedGateway.waitForCall(1)
    failedGateway.complete(1, uid: "isolated-partial", fails: true)
    await failure.value
    check(failed.session == nil && failedGateway.providerUid == nil && failedStore.required &&
        failed.errorMessage == AuthenticationCopy.failed, "Provider failure left a partial identity active")
    let retry = Task { await failed.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await failedGateway.waitForCall(2)
    failedGateway.complete(2, uid: "isolated-retried")
    await retry.value
    check(failed.session?.uid == "isolated-retried" && failed.errorMessage == nil && !failedStore.required,
        "Explicit login could not recover after completed cleanup")

    let cleanupGateway = AuthenticationProbe()
    let cleanupStore = MemoryLogoutIntentStore()
    let cleanup = makeAuthenticationApp(cleanupGateway, store: cleanupStore)
    let pendingCleanup = Task { await cleanup.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await cleanupGateway.waitForCall(1)
    cleanupGateway.failSignOut = true
    cleanup.signOut()
    cleanupGateway.complete(1, uid: "isolated-needs-cleanup")
    await pendingCleanup.value
    check(cleanup.session == nil && cleanup.authenticationCleanupRequired && cleanup.authenticating &&
        cleanup.errorMessage == AuthenticationCopy.cleanup, "Cleanup failure was presented as completed logout")
    await cleanup.signUp(name: "Other", email: "other@example.invalid", password: "fixture-only")
    check(cleanupGateway.calls.count == 1, "Login was allowed while provider cleanup remained unconfirmed")
    cleanupGateway.failSignOut = false
    cleanup.signOut()
    check(cleanupGateway.providerUid == nil && !cleanup.authenticating && cleanupStore.required,
        "Explicit cleanup retry failed to restore a safe signed-out boundary")

    for failureKind in ["read", "write"] {
        let blockedGateway = AuthenticationProbe(providerUid: "isolated-cached")
        let blockedStore = MemoryLogoutIntentStore()
        blockedStore.failRead = failureKind == "read"
        blockedStore.failWrite = failureKind == "write"
        let blocked = makeAuthenticationApp(blockedGateway, store: blockedStore)
        await blocked.signIn(email: "qa@example.invalid", password: "fixture-only")
        check(blockedGateway.calls.isEmpty && blocked.session == nil && blockedGateway.providerUid == nil &&
            blocked.authenticationCleanupRequired, "Storage failure bypassed the durable authentication boundary")
        blockedStore.failRead = false; blockedStore.failWrite = false
        blocked.signOut()
        check(!blocked.authenticating && blockedStore.required, "Explicit storage recovery remained blocked")
    }

    let commitGateway = AuthenticationProbe()
    let commitStore = MemoryLogoutIntentStore()
    let commit = makeAuthenticationApp(commitGateway, store: commitStore)
    let commitRequest = Task { await commit.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await commitGateway.waitForCall(1)
    commitStore.failWrite = true
    commitGateway.complete(1, uid: "isolated-uncommitted")
    await commitRequest.value
    check(commit.session == nil && commitGateway.providerUid == nil && commitStore.required &&
        commit.authenticationCleanupRequired, "Failed policy commit accepted a provider identity")

    let resumeGateway = AuthenticationProbe(providerUid: "isolated-resume")
    let resume = makeAuthenticationApp(resumeGateway, store: MemoryLogoutIntentStore())
    let brokenRestore = Task { await resume.bootstrap() }
    await resumeGateway.waitForCall(1)
    resumeGateway.complete(1, uid: nil, fails: true)
    await brokenRestore.value
    check(resume.authenticationRestoreFailed && !resume.authenticating && resume.session == nil,
        "Read-only restore failure did not retain an explicit retry path")
    let restoreRetry = Task { await resume.bootstrap() }
    await resumeGateway.waitForCall(2)
    resumeGateway.complete(2, uid: "isolated-resume")
    await restoreRetry.value
    check(resume.session?.uid == "isolated-resume" && !resume.authenticationRestoreFailed,
        "Explicit restoration retry did not recover the original identity")
    print("Authentication ownership checks passed: serialized intents, late provider mutation cleanup, cancellation, storage failure and explicit retry; isolated gateways only")
}
