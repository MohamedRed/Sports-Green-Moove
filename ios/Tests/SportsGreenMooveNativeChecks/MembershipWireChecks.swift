import Foundation

func checkMembershipWire() throws {
    for (status, active, expected) in [("requested", false, false), ("active", false, false), ("active", true, true),
        ("rejected", true, false), ("blocked", true, false), (nil, true, true), (nil, false, false), ("active", nil, true)] as [(String?, Bool?, Bool)] {
        let member = ClubMembership(role: "member", status: status, active: active)
        let summary = ClubSummary(id: "club", name: "Club", sport: "Sport", memberCount: 1, roleLabel: "MEMBRE", initials: "CL", memberInitials: [],
            membershipStatus: status, membershipActive: active)
        check(member.isActive == expected && summary.isMember == expected, "Club membership was inferred from a role label or contradictory flags")
    }
    let member: [String: Any] = ["userId": "parent", "clubId": "club", "role": "member", "status": "requested", "active": false]
    var rejected = 0
    for patch in [["userId": "other"], ["clubId": "other"], ["role": ""], ["active": 1], ["status": "bad\nstatus"]] as [[String: Any]] {
        do { _ = try MembershipWire.member(member.merging(patch) { _, next in next }, documentId: "parent_club", uid: "parent", clubId: "club"); fatalError("Invalid or foreign membership accepted") } catch { rejected += 1 }
    }
    let raw: [String: Any] = ["id": "applicant_club", "userId": "applicant", "name": "Synthetic applicant", "role": "member", "status": "requested",
        "active": false, "teamName": NSNull(), "requestVersion": "1700000000.1", "allowedActions": ["approve", "reject"]]
    let page = try MembershipWire.reviews(["items": [raw], "nextCursor": NSNull()], uid: "parent", clubId: "club")
    check(page.items[0].canDecide, "Current manager request cannot be reviewed")
    for patch in [["id": "applicant_other"], ["active": true], ["active": 0], ["role": "clubManager"], ["status": "active"],
        ["requestVersion": "bad"], ["allowedActions": ["approve", "approve"]], ["allowedActions": ["approve", "reject", "other"]],
        ["name": "invalid\u{202e}name"], ["userId": "bad/id"]] as [[String: Any]] {
        do { _ = try MembershipWire.reviews(["items": [raw.merging(patch) { _, next in next }], "nextCursor": NSNull()], uid: "parent", clubId: "club"); fatalError("Malformed manager review accepted") } catch { rejected += 1 }
    }
    let receipt: [String: Any] = ["membershipId": "parent_club", "clubId": "club", "status": "requested", "reused": true]
    _ = try MembershipWire.receipt(receipt, uid: "parent", clubId: "club")
    for patch in [["membershipId": "other_club"], ["clubId": "other"], ["status": NSNull()], ["reused": 1]] as [[String: Any]] {
        do { _ = try MembershipWire.receipt(receipt.merging(patch) { _, next in next }, uid: "parent", clubId: "club"); fatalError("Foreign/malformed request receipt accepted") } catch { rejected += 1 }
    }
    let decision: [String: Any] = ["membershipId": "applicant_club", "status": "active", "reviewId": "review"]
    _ = try MembershipWire.decision(decision, row: page.items[0], decision: .approve)
    for patch in [["membershipId": "other_club"], ["status": "rejected"], ["reviewId": "bad/id"]] as [[String: Any]] {
        do { _ = try MembershipWire.decision(decision.merging(patch) { _, next in next }, row: page.items[0], decision: .approve); fatalError("Foreign/wrong-decision receipt accepted") } catch { rejected += 1 }
    }
    let input = try MembershipRequest.decide(page.items[0], .reject).payload()
    check(input == ["membershipId": "applicant_club", "decision": "reject", "expectedVersion": "1700000000.1"], "Decision lost exact request version")
    for id in ["bad/id", "..", "__reserved__", String(repeating: "a", count: 121)] {
        do { _ = try MembershipRequest.request(id).payload(); fatalError("Invalid request target dispatched") } catch { rejected += 1 }
    }
    var pager = MembershipPager<MembershipClub>()
    try pager.apply(.init(userId: "parent", items: [], cursor: "next"), uid: "parent", requested: nil)
    try pager.apply(.init(userId: "parent", items: [membershipClub()], cursor: "last"), uid: "parent", requested: "next")
    for bad in [MembershipPage(userId: "other", items: [membershipClub("b")], cursor: nil),
        .init(userId: "parent", items: [membershipClub()], cursor: nil), .init(userId: "parent", items: [], cursor: "next")] {
        do { try pager.apply(bad, uid: "parent", requested: "last"); fatalError("Foreign, duplicate or cyclic page accepted") } catch { rejected += 1 }
    }
    check(pager.items.count == 1 && pager.cursor == "last", "Failed page partially changed the current directory")
    print("MembershipWireChecks passed: 8 membership-status combinations, \(rejected) malformed/foreign identity, action, receipt, request and pagination groups; exact versioned decisions and empty-page continuation")
}
