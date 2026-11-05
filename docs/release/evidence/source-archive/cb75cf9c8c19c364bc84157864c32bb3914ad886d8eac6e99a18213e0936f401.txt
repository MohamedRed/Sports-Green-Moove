import Foundation
import Observation

@MainActor
@Observable
final class PublishController {
    private(set) var origin: ResolvedPlace?
    private(set) var destination: ResolvedPlace?
    private(set) var originSuggestions: [PlaceSuggestion] = []
    private(set) var destinationSuggestions: [PlaceSuggestion] = []
    private let access: AccountAccess
    private var active = true
    private var revision = UUID()
    private var pending: Action?
    var loading: Bool { pending != nil || access.waitingForEarlierWork }

    private struct Action {
        let id = UUID()
        let revision: UUID
        let work: AccountWork
    }

    init(access: AccountAccess) { self.access = access }

    func activate() {
        guard access.isCurrent, !active else { return }
        active = true; revision = UUID()
    }

    func close() { active = false; revision = UUID() }

    func seedPlaces(origin initialOrigin: ResolvedPlace?, destination initialDestination: ResolvedPlace?) {
        guard active, access.isCurrent else { return }
        if let initialOrigin, origin == nil {
            origin = initialOrigin
        }
        if let initialDestination, destination == nil {
            destination = initialDestination
        }
    }

    func suggestPlaces(input: String, target: SearchPlaceTarget, firebase: FirebaseGateway, onError: (String?) -> Void) async {
        guard let action = begin() else { return }
        defer { finish(action) }
        guard !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            onError("Saisissez une adresse à chercher.")
            return
        }

        do {
            let suggestions = try await firebase.suggestPlaces(uid: access.context.uid, input: input)
            try requireCurrent(action)
            setSuggestions(suggestions, target: target)
            onError(nil)
        } catch {
            guard current(action) else { return }
            onError("Impossible de chercher cette adresse. Réessayez.")
        }
    }

    func select(_ suggestion: PlaceSuggestion, target: SearchPlaceTarget, firebase: FirebaseGateway, onError: (String?) -> Void) async {
        guard let action = begin() else { return }
        defer { finish(action) }
        do {
            let place = try await firebase.resolvePlace(uid: access.context.uid, placeId: suggestion.placeId)
            try requireCurrent(action)
            if target == .origin {
                origin = place
                originSuggestions = []
            } else {
                destination = place
                destinationSuggestions = []
            }
            onError(nil)
        } catch {
            guard current(action) else { return }
            onError("Impossible de confirmer cette adresse. Réessayez.")
        }
    }

    func publish(draft: TripPublishDraft?, firebase: FirebaseGateway, onNotice: (String) -> Void, onError: (String?) -> Void,
        onPublished: @escaping @MainActor (AccountAccess) async -> Void) async {
        guard let action = begin() else { return }
        defer { finish(action) }
        guard let draft else {
            onError("Choisissez un départ et une destination dans les suggestions.")
            return
        }

        do {
            let tripId = try await firebase.createTrip(draft: draft)
            try requireCurrent(action)
            onNotice("Trajet publié: \(tripId)")
            try requireCurrent(action)
            await onPublished(access)
        } catch {
            guard current(action) else { return }
            onError(error.localizedDescription)
        }
    }

    private func begin() -> Action? {
        guard active, pending == nil, access.context.role == .driver,
              access.context.grantedRoles.contains(.driver), let work = access.begin() else { return nil }
        let action = Action(revision: revision, work: work)
        pending = action
        return action
    }

    private func current(_ action: Action) -> Bool {
        active && revision == action.revision && pending?.id == action.id && access.owns(action.work)
    }

    private func requireCurrent(_ action: Action) throws {
        try Task.checkCancellation()
        guard current(action) else { throw CancellationError() }
    }

    private func finish(_ action: Action) {
        access.finish(action.work)
        if pending?.id == action.id { pending = nil }
    }

    private func setSuggestions(_ suggestions: [PlaceSuggestion], target: SearchPlaceTarget) {
        if target == .origin {
            originSuggestions = suggestions
        } else {
            destinationSuggestions = suggestions
        }
    }
}
