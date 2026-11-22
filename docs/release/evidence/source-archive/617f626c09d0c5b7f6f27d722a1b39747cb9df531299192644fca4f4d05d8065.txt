import Foundation
import Observation

@MainActor @Observable final class SearchActivityState {
    enum Lane: Hashable { case origin, destination, matches }
    struct Action {
        let id = UUID()
        let revision: UUID
        let lane: Lane
        let access: AccountAccess
        let work: AccountWork
    }
    private var owner: AccountAccess?
    private var active = false
    private var revision = UUID()
    private var pending: [UUID: Action] = [:]
    var busy: Bool { !pending.isEmpty || owner?.waitingForEarlierWork == true }
    var access: AccountAccess? { active && owner?.isCurrent == true ? owner : nil }
    func belongs(to access: AccountAccess) -> Bool { owner?.context == access.context }
    func activate(_ access: AccountAccess) {
        guard access.isCurrent else { return }
        if !active || !belongs(to: access) { owner = access; active = true; revision = UUID() }
    }
    func suspend() { active = false; revision = UUID() }
    func reset() { suspend(); owner = nil }
    func available(_ lane: Lane, access: AccountAccess) -> Bool {
        active && belongs(to: access) && access.isCurrent && !access.waitingForEarlierWork &&
            !pending.values.contains(where: { $0.lane == lane })
    }
    func begin(_ lane: Lane, access: AccountAccess) -> Action? {
        guard available(lane, access: access), let work = access.begin() else { return nil }
        let action = Action(revision: revision, lane: lane, access: access, work: work)
        pending[action.id] = action; return action
    }
    func current(_ action: Action) -> Bool {
        active && revision == action.revision && belongs(to: action.access) && pending[action.id] != nil && action.access.owns(action.work)
    }
    func finish(_ action: Action) { pending[action.id] = nil; action.access.finish(action.work) }
}
