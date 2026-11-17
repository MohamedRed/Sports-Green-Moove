import Foundation

func checkSupportResponses() throws {
    let reply: [String: Any] = ["id": String(repeating: "a", count: 64), "text": "Votre demande est traitée.", "sequence": 1, "sentAtMillis": 2000]
    let report: [String: Any] = ["id": "ticket", "reason": "Trajet", "description": "Une demande de support.", "status": "closed", "emergency": false,
                               "createdAtMillis": 1000, "updatedAtMillis": 2000, "replyCount": 1, "lastReply": reply, "reviewNote": "PRIVATE"]
    let page = try SupportWire.reports(["items": [report], "nextCursor": NSNull()])
    check(page.items.first?.status == .closed, "Support status must be decoded")
    check(page.items.first?.lastReply?.text == reply["text"] as? String, "Support response must be decoded")
    let detail = try SupportWire.detail(["report": report, "replies": ["items": [reply], "nextCursor": NSNull()]], reportId: "ticket")
    check(detail.replies.items.count == 1, "Support response count changed")
    for patch in [["status": "unknown"], ["replyCount": -1], ["replyCount": true], ["lastReply": NSNull()], ["createdAtMillis": 0]] as [[String: Any]] {
        var invalid = report; invalid.merge(patch) { _, next in next }
        do { _ = try SupportWire.reports(["items": [invalid], "nextCursor": NSNull()]); fatalError("Invalid support record was accepted") } catch { }
    }
    do { _ = try SupportWire.reports(["items": [report, report], "nextCursor": NSNull()]); fatalError("Duplicate support records accepted") } catch { }
    do { _ = try SupportWire.detail(["report": report, "replies": ["items": [reply], "nextCursor": NSNull()]], reportId: "foreign"); fatalError("Foreign support detail accepted") } catch { }
    check(!SupportWire.validCursor("bad/token"), "Malformed support cursor accepted")
    print("SupportChecks passed")
}
