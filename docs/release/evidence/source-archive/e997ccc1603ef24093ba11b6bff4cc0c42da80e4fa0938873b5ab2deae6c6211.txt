import Foundation

func checkChildAccountWire() throws {
    let target = try isolatedChildTarget(), uid = "isolated-parent", link = isolatedChildLink(target)
    let payload = try ChildAccountWire.target(target)
    check(payload == ["childId": "child-profile", "clubId": "club", "expectedChildInstanceId": String(repeating: "a", count: 64)], "Child target payload changed")
    try ChildInvitationWire.validate(link, target: target, now: isolatedChildNow)
    let code: [String: Any] = ["accountUserId": "child-login", "code": isolatedChildCode, "expiresAtMillis": isolatedChildNow + 600_000]
    let parsedCode = try ChildAccountWire.code(code, uid: "child-login")
    check(parsedCode.accountUserId == "child-login", "Code account identity changed")
    let receipt: [String: Any] = ["accountUserId": "child-login", "childId": target.childId, "childInstanceId": target.childInstanceId, "replayed": true]
    let parsedReceipt = try ChildAccountWire.receipt(receipt, uid: uid, target: target)
    check(parsedReceipt.replayed, "Replay receipt lost its explicit server flag")
    var rejected = 0
    func rejects(_ action: () throws -> Void) {
        do { try action(); fatalError("Malformed child-account response accepted") } catch { rejected += 1 }
    }
    for (key, values) in ["expiresAtMillis": [true, -1, 1.5, Double.infinity, NSNull()] as [Any],
        "accountUserId": ["foreign", NSNull()], "code": ["short", String(repeating: "C", count: 32), NSNull()]] {
        for value in values { var raw = code; raw[key] = value; rejects { _ = try ChildAccountWire.code(raw, uid: "child-login") } }
    }
    for (key, values) in ["accountUserId": [uid, "../foreign", NSNull()] as [Any], "childId": ["other", NSNull()],
        "childInstanceId": [String(repeating: "b", count: 64), NSNull()], "replayed": [1, "true", NSNull()]] {
        for value in values { var raw = receipt; raw[key] = value; rejects { _ = try ChildAccountWire.receipt(raw, uid: uid, target: target) } }
    }
    let token = String(repeating: "b", count: 64), base = "https://sports-green-moove-prod.web.app/child-invitation"
    for text in [base + "?token=x#" + token, "http://sports-green-moove-prod.web.app/child-invitation#" + token,
        base + "/#" + token, base + "#" + String(repeating: "a", count: 64), base + "#%62" + String(token.dropFirst()),
        "https://other.example/child-invitation#" + token, "https://x@sports-green-moove-prod.web.app/child-invitation#" + token,
        "https://sports-green-moove-prod.web.app:443/child-invitation#" + token] {
        rejects { try ChildInvitationWire.validate(ChildInvitationLink(target: target, url: URL(string: text)!, current: link.current), target: target, now: isolatedChildNow) }
    }
    rejects { try ChildInvitationWire.validate(link, target: target, now: link.current.expiresAtMillis) }
    rejects { _ = try ChildAccountWire.current([:]) }
    let absent = try ChildAccountWire.current(["current": NSNull()])
    check(absent == nil, "Explicit absent invitation not recognized")
    for value: Any in [1, false, "true", NSNull()] {
        rejects { try ChildAccountWire.revocation(["revoked": value, "invitationHash": link.current.invitationHash], hash: link.current.invitationHash) }
    }
    try ChildAccountWire.revocation(["revoked": true, "invitationHash": link.current.invitationHash], hash: link.current.invitationHash)
    print("ChildAccountWireChecks passed: exact identity, immutable profile, strict flags/numbers, private HTTPS origin/fragment/fingerprint and \(rejected) malformed response rejections")
}
