import Foundation

@MainActor
func checkLogoutIntentPersistence() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("sgm-auth-policy-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: root) }
    let file = root.appendingPathComponent("session-policy.json")
    func requirePolicy(_ store: any LogoutIntentStore, _ expected: Bool, _ message: String) throws {
        let actual = try store.requiresSignOut()
        check(actual == expected, message)
    }
    let first = FileLogoutIntentStore(file: file)
    try requirePolicy(first, true, "Missing policy allowed untracked SDK credentials to restore")
    try first.setRequiresSignOut(true)
    let bytes = try Data(contentsOf: file)
    guard let record = try JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
        fatalError("Logout policy was not a structured record")
    }
    check(Set(record.keys) == Set(["version", "requiresSignOut"]), "Logout policy persisted account or credential data")
    let recreatedStore = FileLogoutIntentStore(file: file)
    try requirePolicy(recreatedStore, true, "Logout intent did not survive store recreation")

    let gateway = AuthenticationProbe(providerUid: "isolated-interrupted-login")
    let recreated = makeAuthenticationApp(gateway, store: recreatedStore)
    await recreated.bootstrap()
    check(gateway.calls.isEmpty && gateway.providerUid == nil && recreated.session == nil &&
        gateway.signOutCalls == 1, "Fresh controller restored SDK credentials despite durable logout intent")
    let explicit = Task { await recreated.signIn(email: "qa@example.invalid", password: "fixture-only") }
    await gateway.waitForCall(1)
    try requirePolicy(recreatedStore, true, "Pending login cleared the interrupted-login guard too early")
    gateway.complete(1, uid: "isolated-explicit-login")
    await explicit.value
    try requirePolicy(recreatedStore, false, "Accepted explicit login did not commit its policy")

    let next = makeAuthenticationApp(gateway, store: FileLogoutIntentStore(file: file))
    let restore = Task { await next.bootstrap() }
    await gateway.waitForCall(2)
    gateway.complete(2, uid: "isolated-explicit-login")
    await restore.value
    check(next.session?.uid == "isolated-explicit-login", "Committed identity could not restore after recreation")

    try Data("{\"version\":2,\"requiresSignOut\":false}".utf8).write(to: file, options: .atomic)
    let corrupted = makeAuthenticationApp(AuthenticationProbe(providerUid: "isolated-must-not-restore"),
        store: FileLogoutIntentStore(file: file))
    await corrupted.bootstrap()
    check(corrupted.session == nil && corrupted.authenticationCleanupRequired,
        "Unknown policy version was treated as permission to restore")
    corrupted.signOut()
    try requirePolicy(FileLogoutIntentStore(file: file), true, "Explicit logout could not replace invalid policy safely")
    print("Logout intent checks passed: atomic file recreation, interrupted provider identity refusal, explicit login and corrupt-policy denial; no native process-death proof")
}
