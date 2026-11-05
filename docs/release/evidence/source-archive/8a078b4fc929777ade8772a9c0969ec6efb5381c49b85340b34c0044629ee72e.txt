import Foundation

func checkTeamChatWire() throws {
    let request = UUID(uuidString: "00000000-0000-4000-8000-000000000001")!
    let vectors: [(String, String)] = [
        ("parent", "f08b45bd2aad2df5221c9738364aa87e258d2b550466a3bae928ffe7d32b7fca"),
        ("élève", "496022009f5ac5a08dda4f972fc4377f90a4cf53c94f0ae385ca319fdbd81b95"),
        ("a\"b\\c", "37d4ee9b2ffb6b9b0f673c6b062ebf654cc467c441cd7c8fa7dffb81033555dc"),
        ("u\u{2028}v", "9b51501d998fb476f959f151442046995359bfeb906ef3c1d659095631e65dc1"),
        ("__", "2d584171d080e13ff07bfe01f7eaeb9fabbb82a83203f392a9f5962d2f5a266a"),
        ("u\u{1f600}", "3f185506ac27670cf547ac967029605274eaca5214ab9ccfe062ddb18149e991"),
    ]
    for (uid, hash) in vectors {
        let actual = try TeamChatIdentity.operation(uid: uid, requestId: request)
        check(actual == hash, "Team message identity differs from the server JSON/SHA-256 contract")
    }
    let base = teamWirePage(), parsed = try TeamChatWire.page(base, uid: "parent", target: isolatedTeamTarget)
    check(parsed.items.count == 1 && parsed.accessVersion == isolatedTeamVersion, "Team page failed strict decoding")
    let changes: [[String: Any]] = [
        ["currentUserId": "other"], ["teamId": "other"], ["teamInstanceId": String(repeating: "c", count: 64)],
        ["historyPolicy": "all-history"], ["accessVersion": false], ["accessVersion": ""], ["title": "bad\nname"],
        ["nextCursor": true], ["nextCursor": ""], ["nextCursor": "bad cursor"], ["items": [false]],
        ["items": Array(repeating: teamWireMessage(), count: 51)], ["items": [teamWireMessage(), teamWireMessage()]],
    ]
    var rejected = 0
    for change in changes {
        var value = base; value.merge(change, uniquingKeysWith: { _, next in next })
        do { _ = try TeamChatWire.page(value, uid: "parent", target: isolatedTeamTarget); fatalError("Malformed team page accepted") }
        catch { rejected += 1 }
    }
    for key in ["title", "nextCursor", "items", "currentUserId"] {
        var value = base; value.removeValue(forKey: key)
        do { _ = try TeamChatWire.page(value, uid: "parent", target: isolatedTeamTarget); fatalError("Missing team page field accepted") }
        catch { rejected += 1 }
    }
    let rowChanges: [[String: Any]] = [
        ["senderUserId": "bad/path"], ["id": String(repeating: "f", count: 64)], ["requestId": "not-a-uuid"],
        ["body": " "], ["body": String(repeating: "a", count: 1001)], ["body": " untrimmed "],
        ["needsRead": 1], ["sequence": true], ["sequence": 0], ["sequence": 1.5],
        ["createdAtSeconds": Double.infinity], ["createdAtNanos": -1], ["createdAtNanos": 1_000_000_000], ["authorName": "bad\nname"],
    ]
    for change in rowChanges {
        var row = teamWireMessage(); row.merge(change, uniquingKeysWith: { _, next in next })
        var value = base; value["items"] = [row]
        do { _ = try TeamChatWire.page(value, uid: "parent", target: isolatedTeamTarget); fatalError("Malformed team message accepted") }
        catch { rejected += 1 }
    }
    let own = isolatedTeamMessage(1, sender: "parent")
    var ownRow = teamWireMessage(own); ownRow["needsRead"] = true
    var ownPage = base; ownPage["items"] = [ownRow]
    do { _ = try TeamChatWire.page(ownPage, uid: "parent", target: isolatedTeamTarget); fatalError("Own unread team message accepted") }
    catch { rejected += 1 }
    try checkTeamChoicesAndRequests()
    print("TeamChatWireChecks passed: \(rejected) malformed page/message groups rejected and 6 server JSON/hash identity vectors; exact account, team instance, admission, timestamps, boolean and message identity contracts")
}

private func checkTeamChoicesAndRequests() throws {
    let choices: [String: Any] = ["currentUserId": "parent", "kind": "clubs", "clubId": NSNull(), "items": [], "nextCursor": "more"]
    let page = try TeamChatWire.choices(choices, uid: "parent", clubId: nil)
    check(page.items.isEmpty && page.nextCursor == "more", "Empty team directory scan was mistaken for exhaustion")
    var rejected = 0
    for change in [["currentUserId": "other"], ["kind": "teams"], ["clubId": "foreign"], ["nextCursor": "bad token"]] as [[String: Any]] {
        var value = choices; value.merge(change, uniquingKeysWith: { _, next in next })
        do { _ = try TeamChatWire.choices(value, uid: "parent", clubId: nil); fatalError("Foreign/malformed choices accepted") }
        catch { rejected += 1 }
    }
    let requestId = UUID(uuidString: "00000000-0000-4000-8000-000000000001")!
    let id = try TeamChatIdentity.operation(uid: "parent", requestId: requestId)
    let receipt: [String: Any] = ["currentUserId": "parent", "teamInstanceId": isolatedTeamTarget.instanceId,
        "messageId": id, "sequence": 1, "reused": false]
    let accepted = try TeamChatWire.receipt(receipt, uid: "parent", target: isolatedTeamTarget, requestId: requestId)
    check(accepted == id, "Correlated team receipt was lost")
    for change in [["currentUserId": "other"], ["teamInstanceId": String(repeating: "f", count: 64)],
                   ["messageId": String(repeating: "f", count: 64)], ["reused": 1], ["sequence": true]] as [[String: Any]] {
        var value = receipt; value.merge(change, uniquingKeysWith: { _, next in next })
        do { _ = try TeamChatWire.receipt(value, uid: "parent", target: isolatedTeamTarget, requestId: requestId); fatalError("Uncorrelated team receipt accepted") }
        catch { rejected += 1 }
    }
    let read: [String: Any] = ["currentUserId": "parent", "teamInstanceId": isolatedTeamTarget.instanceId,
        "accessVersion": isolatedTeamVersion, "readMessageIds": [id]]
    try TeamChatWire.reads(read, uid: "parent", target: isolatedTeamTarget, version: isolatedTeamVersion, ids: [id])
    for change in [["accessVersion": String(repeating: "f", count: 64)], ["readMessageIds": []],
                   ["readMessageIds": [id, id]], ["currentUserId": "other"]] as [[String: Any]] {
        var value = read; value.merge(change, uniquingKeysWith: { _, next in next })
        do { try TeamChatWire.reads(value, uid: "parent", target: isolatedTeamTarget, version: isolatedTeamVersion, ids: [id]); fatalError("Uncorrelated team read accepted") }
        catch { rejected += 1 }
    }
    let request = TeamChatRequest.send(isolatedTeamTarget, body: "Message", requestId: requestId)
    let payload = try request.payload()
    check(request.name == "sendTeamChatMessage" && payload["clientMessageId"] as? String == requestId.uuidString.lowercased() &&
        payload["teamId"] as? String == isolatedTeamTarget.teamId && payload["expectedTeamInstanceId"] as? String == isolatedTeamTarget.instanceId,
        "Typed team request changed the server payload")
    for invalid in [TeamChatRequest.send(isolatedTeamTarget, body: " bad trim ", requestId: requestId),
        .read(isolatedTeamTarget, accessVersion: isolatedTeamVersion, ids: []),
        .read(isolatedTeamTarget, accessVersion: isolatedTeamVersion, ids: [id, id]),
        .messages(isolatedTeamTarget, cursor: "invalid cursor"), .choices(clubId: "bad/path", cursor: nil)] {
        do { _ = try invalid.payload(); fatalError("Invalid typed team request accepted") } catch { rejected += 1 }
    }
    check(TeamChatText.normalized("\u{feff} Message \u{00a0}") == "Message", "Team body normalization differs from the server")
    print("TeamChatRequestChecks passed: \(rejected) directory/receipt/read/request groups rejected; stable write identity, exact visible-read batch and explicit null/cursor semantics")
}

private func teamWireMessage(_ row: TeamChatMessage = isolatedTeamMessage(1)) -> [String: Any] {
    var value: [String: Any] = ["id": row.id, "senderUserId": row.senderId,
     "body": row.body, "requestId": row.requestId.uuidString.lowercased(), "sequence": row.sequence,
     "createdAtSeconds": row.seconds, "createdAtNanos": row.nanos, "needsRead": row.needsRead]
    if let author = row.author { value["authorName"] = author } else { value["authorName"] = NSNull() }
    return value
}
private func teamWirePage() -> [String: Any] {
    ["currentUserId": "parent", "teamId": isolatedTeamTarget.teamId, "teamInstanceId": isolatedTeamTarget.instanceId,
     "historyPolicy": "after-current-admission", "title": "Synthetic team", "accessVersion": isolatedTeamVersion,
     "items": [teamWireMessage()], "nextCursor": NSNull()]
}
