import Foundation

struct SearchRequestContext: Hashable, Sendable {
    let owner: AccountContext
    var uid: String { owner.uid }
    let form: SearchFormState
    let origin: ResolvedPlace
    let destination: ResolvedPlace

    var criteria: TripSearchCriteria {
        TripSearchCriteria(requesterUserId: uid, origin: origin, destination: destination,
            desiredDepartureAtIso: form.desiredDepartureAtIso, seatsNeeded: form.seatsNeeded,
            baggage: form.baggage, returnTrip: form.returnTrip,
            requireChildTracking: form.requireChildTracking, guardianConsent: form.guardianConsent,
            childUserId: form.childUserId)
    }
}

struct SearchRequestState: Sendable {
    struct Request: Equatable, Sendable {
        let id: UUID
        let context: SearchRequestContext
    }
    private(set) var pending: Request?
    private(set) var completed: SearchRequestContext?

    mutating func invalidate() { pending = nil; completed = nil }

    mutating func begin(_ context: SearchRequestContext) -> Request? {
        invalidate()
        guard !context.uid.isEmpty, context.form.validationMessage == nil else { return nil }
        let request = Request(id: UUID(), context: context)
        pending = request
        return request
    }

    mutating func finish(_ request: Request, owner: AccountContext?, succeeded: Bool) -> Bool {
        guard pending == request else { return false }
        pending = nil
        guard request.context.owner == owner else { completed = nil; return false }
        completed = succeeded ? request.context : nil
        return true
    }

    func permitsBooking(_ context: SearchRequestContext) -> Bool {
        !context.uid.isEmpty && context.form.validationMessage == nil && completed == context
    }
}
