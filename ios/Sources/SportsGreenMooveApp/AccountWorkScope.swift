import Foundation
import Observation

struct AccountContext: Hashable, Sendable {
    let id: UUID
    let uid: String
    let role: AppRole
    let grantedRoles: [AppRole]
}

struct AccountWork: Sendable {
    fileprivate let id: UUID
    fileprivate let context: AccountContext
}

@MainActor @Observable
final class AccountWorkScope {
    private(set) var context: AccountContext?
    private var pending: [UUID: AccountContext] = [:]
    var busy: Bool { !pending.isEmpty }
    var access: AccountAccess? { context.map { AccountAccess(scope: self, context: $0) } }

    func replace(session: AuthSession?, role: AppRole) {
        guard let session, session.isValid, session.roles.contains(role) else { clear(); return }
        context = AccountContext(id: UUID(), uid: session.uid, role: role, grantedRoles: session.roles)
    }

    func clear() { context = nil }

    fileprivate func begin(_ context: AccountContext) -> AccountWork? {
        guard !Task.isCancelled, self.context == context,
              !pending.values.contains(where: { $0 != context }) else { return nil }
        let work = AccountWork(id: UUID(), context: context)
        pending[work.id] = context
        return work
    }

    fileprivate func owns(_ work: AccountWork) -> Bool {
        context == work.context && pending[work.id] == work.context
    }

    fileprivate func finish(_ work: AccountWork) {
        if pending[work.id] == work.context { pending[work.id] = nil }
    }

    fileprivate func waiting(for context: AccountContext) -> Bool {
        pending.values.contains { $0 != context }
    }
}

struct AccountAccess: Sendable {
    fileprivate let scope: AccountWorkScope
    let context: AccountContext

    @MainActor var isCurrent: Bool { !Task.isCancelled && scope.context == context }
    @MainActor var waitingForEarlierWork: Bool { scope.waiting(for: context) }
    @MainActor func begin() -> AccountWork? { scope.begin(context) }
    @MainActor func owns(_ work: AccountWork) -> Bool { isCurrent && work.context == context && scope.owns(work) }
    @MainActor func finish(_ work: AccountWork) { if work.context == context { scope.finish(work) } }
    @MainActor func requireCurrent(_ work: AccountWork) throws {
        try Task.checkCancellation()
        guard owns(work) else { throw CancellationError() }
    }
}
