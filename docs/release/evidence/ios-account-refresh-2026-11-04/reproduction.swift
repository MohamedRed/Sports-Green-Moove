import Foundation

let probe = AppDataProbe(suspended: [1])
let state = AppState(auth: UnconfiguredAuthGateway(), firebase: AppDataFixtureGateway(probe: probe))
state.session = AuthSession(uid: "isolated-parent-a", email: nil)
let request = Task { await state.refreshAppData() }
await probe.waitForCall(1)
state.signOut()
await probe.release(1)
await request.value
let calls = await probe.names()
print("lateReadRestoredPrivateData=\(!state.trips.isEmpty || !state.children.isEmpty)")
print("providerReadCount=\(calls.count)")
print("authenticated=\(state.session != nil)")
