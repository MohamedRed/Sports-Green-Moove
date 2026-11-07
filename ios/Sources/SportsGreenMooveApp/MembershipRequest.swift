import Foundation

enum MembershipRequest: Sendable {
    case request(String)
    case clubs(String?)
    case members(String, String?)
    case decide(MembershipReview, MembershipDecision)
    var name: String {
        switch self {
        case .request: "requestClubMembership"
        case .clubs: "listMembershipReviewClubs"
        case .members: "listClubMemberships"
        case .decide: "reviewClubMembership"
        }
    }
    func payload() throws -> [String: String] {
        switch self {
        case let .request(club):
            try MembershipWire.require(MembershipWire.requestableId(club)); return ["clubId": club]
        case let .clubs(cursor):
            if let cursor { _ = try MembershipWire.cursor(cursor); return ["cursor": cursor] }; return [:]
        case let .members(club, cursor):
            try MembershipWire.require(MembershipWire.id(club)); var data = ["clubId": club]
            if let cursor { _ = try MembershipWire.cursor(cursor); data["cursor"] = cursor }; return data
        case let .decide(row, decision):
            try MembershipWire.require(row.canDecide && MembershipWire.id(row.id))
            return ["membershipId": row.id, "decision": decision.rawValue, "expectedVersion": try MembershipWire.version(row.version)]
        }
    }
}
