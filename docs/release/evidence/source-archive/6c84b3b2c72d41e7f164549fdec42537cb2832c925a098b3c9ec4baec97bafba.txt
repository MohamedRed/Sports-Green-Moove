import Foundation

extension AppState {
    func invalidateSearch() {
        searchRequests.invalidate()
        searchMatches = []
    }

    func invalidatePlace(_ target: SearchPlaceTarget) {
        searchPlaceRequests[target] = nil
        switch target {
        case .origin: searchOrigin = nil; originSuggestions = []
        case .destination: searchDestination = nil; destinationSuggestions = []
        }
        invalidateSearch()
    }

    func suggestPlaces(input: String, target: SearchPlaceTarget) async {
        guard let uid = session?.uid else { return }
        let request = UUID()
        searchPlaceRequests[target] = request
        defer { finishPlaceRequest(request, target: target) }
        do {
            let suggestions = try await firebase.suggestPlaces(input: input)
            guard currentPlaceRequest(request, target: target, uid: uid) else { return }
            switch target {
            case .origin: originSuggestions = suggestions
            case .destination: destinationSuggestions = suggestions
            }
        } catch {
            guard currentPlaceRequest(request, target: target, uid: uid) else { return }
            errorMessage = error.localizedDescription
        }
    }

    func selectPlace(_ suggestion: PlaceSuggestion, target: SearchPlaceTarget) async {
        guard let uid = session?.uid else { return }
        invalidatePlace(target)
        let request = UUID()
        searchPlaceRequests[target] = request
        defer { finishPlaceRequest(request, target: target) }
        do {
            let place = try await firebase.resolvePlace(placeId: suggestion.placeId)
            guard currentPlaceRequest(request, target: target, uid: uid) else { return }
            switch target {
            case .origin: searchOrigin = place
            case .destination: searchDestination = place
            }
        } catch {
            guard currentPlaceRequest(request, target: target, uid: uid) else { return }
            errorMessage = error.localizedDescription
        }
    }

    func prepareSearch(form: SearchFormState) -> SearchRequestState.Request? {
        invalidateSearch()
        guard let uid = session?.uid, !uid.isEmpty else {
            errorMessage = "Connectez-vous pour rechercher un trajet."
            return nil
        }
        if let message = form.validationMessage { errorMessage = message; return nil }
        guard let origin = searchOrigin, let destination = searchDestination else {
            errorMessage = "Choisissez un départ et une destination dans les suggestions."
            return nil
        }
        let context = SearchRequestContext(uid: uid, form: form, origin: origin, destination: destination)
        errorMessage = nil
        return searchRequests.begin(context)
    }

    func runSearch(_ request: SearchRequestState.Request) async {
        guard searchRequests.pending == request, session?.uid == request.context.uid else { return }
        do {
            let matches = try await firebase.searchTripMatches(criteria: request.context.criteria)
            guard searchRequests.finish(request, uid: session?.uid, succeeded: true) else { return }
            searchMatches = matches
        } catch {
            guard searchRequests.finish(request, uid: session?.uid, succeeded: false) else { return }
            errorMessage = error.localizedDescription
        }
    }

    func requestSearchMatch(_ match: TripMatchSummary, form: SearchFormState) async {
        guard let access = accountAccess else { return }
        await requestSearchMatch(match, form: form, access: access)
    }

    func requestSearchMatch(_ match: TripMatchSummary, form: SearchFormState, access: AccountAccess) async {
        guard access.isCurrent else { return }
        guard let uid = session?.uid, let origin = searchOrigin, let destination = searchDestination,
              searchRequests.permitsBooking(SearchRequestContext(uid: uid, form: form, origin: origin, destination: destination)),
              searchMatches.contains(match), match.tripId == match.summary.id else {
            errorMessage = "Les options ont changé. Relancez la recherche avant de réserver."
            return
        }
        await requestBooking(trip: match.summary, childId: form.childUserId, seats: form.seatsNeeded, access: access)
    }

    private func currentPlaceRequest(_ request: UUID, target: SearchPlaceTarget, uid: String) -> Bool {
        session?.uid == uid && searchPlaceRequests[target] == request
    }

    private func finishPlaceRequest(_ request: UUID, target: SearchPlaceTarget) {
        if searchPlaceRequests[target] == request { searchPlaceRequests[target] = nil }
    }
}
