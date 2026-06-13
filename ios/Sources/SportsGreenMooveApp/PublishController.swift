import Foundation
import Observation

@MainActor
@Observable
final class PublishController {
    var origin: ResolvedPlace?
    var destination: ResolvedPlace?
    var originSuggestions: [PlaceSuggestion] = []
    var destinationSuggestions: [PlaceSuggestion] = []
    var loading = false

    func seedPlaces(origin initialOrigin: ResolvedPlace?, destination initialDestination: ResolvedPlace?) {
        if let initialOrigin, origin == nil {
            origin = initialOrigin
        }
        if let initialDestination, destination == nil {
            destination = initialDestination
        }
    }

    func suggestPlaces(input: String, target: SearchPlaceTarget, firebase: FirebaseGateway, onError: (String?) -> Void) async {
        guard !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            onError("Saisissez une adresse à chercher.")
            return
        }

        loading = true
        defer { loading = false }
        do {
            let suggestions = try await firebase.suggestPlaces(input: input)
            setSuggestions(suggestions, target: target)
            onError(nil)
        } catch {
            onError(error.localizedDescription)
        }
    }

    func select(_ suggestion: PlaceSuggestion, target: SearchPlaceTarget, firebase: FirebaseGateway, onError: (String?) -> Void) async {
        loading = true
        defer { loading = false }
        do {
            let place = try await firebase.resolvePlace(placeId: suggestion.placeId)
            if target == .origin {
                origin = place
                originSuggestions = []
            } else {
                destination = place
                destinationSuggestions = []
            }
            onError(nil)
        } catch {
            onError(error.localizedDescription)
        }
    }

    func publish(draft: TripPublishDraft?, firebase: FirebaseGateway, onNotice: (String) -> Void, onError: (String?) -> Void, onPublished: @escaping () async -> Void) async {
        guard let draft else {
            onError("Choisissez un départ et une destination dans les suggestions.")
            return
        }

        loading = true
        defer { loading = false }
        do {
            let tripId = try await firebase.createTrip(draft: draft)
            onNotice("Trajet publié: \(tripId)")
            await onPublished()
        } catch {
            onError(error.localizedDescription)
        }
    }

    private func setSuggestions(_ suggestions: [PlaceSuggestion], target: SearchPlaceTarget) {
        if target == .origin {
            originSuggestions = suggestions
        } else {
            destinationSuggestions = suggestions
        }
    }
}
