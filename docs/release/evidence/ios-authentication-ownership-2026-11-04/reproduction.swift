import Foundation

let gateway = AuthenticationProbe()
let reads = AppDataProbe()
#if AUTH_OWNER_CANDIDATE
let app = AppState(auth: gateway, firebase: AppDataFixtureGateway(probe: reads),
    authentication: AuthenticationState(makeStore: { MemoryLogoutIntentStore() }))
#else
let app = AppState(auth: gateway, firebase: AppDataFixtureGateway(probe: reads))
#endif
let request = Task { await app.signIn(email: "qa@example.invalid", password: "fixture-only") }
await gateway.waitForCall(1)
app.signOut()
gateway.complete(1, uid: "isolated-late-parent")
await request.value
let names = await reads.names()
print("visibleSessionRestoredAfterLogout=\(app.session != nil)")
print("simulatedProviderIdentityRemainedAfterLogout=\(gateway.providerUid != nil)")
print("providerSignOutCallCount=\(gateway.signOutCalls)")
print("laterPrivateReadCount=\(names.count)")
