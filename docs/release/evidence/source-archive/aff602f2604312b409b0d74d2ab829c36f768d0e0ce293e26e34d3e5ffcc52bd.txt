import Foundation

let decision: MembershipDecision = CommandLine.arguments.last == "approve" ? .approve : .reject
let scope = AccountWorkScope()
scope.replace(session: .init(uid: "ui-user", email: nil, displayName: nil, roles: [.clubManager]), role: .clubManager)
let access = scope.access!, gateway = UITestFirebaseGateway()
let state = MembershipReviewState(access: access, gateway: gateway)
await state.resume()
precondition(state.loaded && state.clubs.count == 1 && state.error == nil)
precondition(state.clubs[0].id == "club-tennis" && !state.busy)
await state.select(state.clubs[0])
precondition(state.club?.id == "club-tennis" && state.loaded && state.error == nil)
precondition(state.items.count == 1 && state.canDecide && !state.busy)
let row = state.items[0]
precondition(row.id == "ui-parent_club-tennis" && row.canDecide && row.version == "1700000000.1")
let accepted = await state.decide(row, decision: decision)
precondition(accepted && state.requiresRefresh && state.items[0].status == "requested")
await state.refresh()
precondition(state.items[0].status == (decision == .approve ? "active" : "rejected"))
precondition(!state.items[0].canDecide && !state.items[0].actions.contains(decision))
state.close()
precondition(state.items.isEmpty && state.club == nil && !scope.busy)
print("Membership fixture state passed: \(decision.rawValue), original fixture gateway and production review state; not hit testing or a phone")
