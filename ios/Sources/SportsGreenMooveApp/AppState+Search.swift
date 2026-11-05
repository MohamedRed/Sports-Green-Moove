import Foundation

extension AppState {
    func activateSearch(access: AccountAccess) { searchActivity.activate(access) }

    func suspendSearch(access: AccountAccess) {
        guard searchActivity.belongs(to: access) else { return }
        searchActivity.suspend(); invalidateSearch(); searchPlaceRequests = [:]
        originSuggestions = []; destinationSuggestions = []
    }

    func resetSearchSession() {
        searchActivity.reset(); invalidateSearch(); searchPlaceRequests = [:]
        searchOrigin = nil; searchDestination = nil; originSuggestions = []; destinationSuggestions = []
    }

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

    func suggestPlaces(input: String, target: SearchPlaceTarget, access: AccountAccess) async {
        let lane: SearchActivityState.Lane = target == .origin ? .origin : .destination
        guard let action = searchActivity.begin(lane, access: access) else { return }
        searchPlaceRequests[target] = action.id
        defer { finishPlaceRequest(action, target: target) }
        do {
            let query = try PlaceSearchWire.query(input)
            let suggestions = try await firebase.suggestPlaces(uid: access.context.uid, input: query)
            guard currentPlaceRequest(action, target: target) else { return }
            try PlaceSearchWire.validate(suggestions)
            switch target {
            case .origin: originSuggestions = suggestions
            case .destination: destinationSuggestions = suggestions
            }
        } catch {
            guard currentPlaceRequest(action, target: target) else { return }
            errorMessage = "Impossible de chercher cette adresse. Réessayez."
        }
    }

    func selectPlace(_ suggestion: PlaceSuggestion, target: SearchPlaceTarget, access: AccountAccess) async {
        let displayed = target == .origin ? originSuggestions : destinationSuggestions
        guard displayed.contains(suggestion) else { return }
        let lane: SearchActivityState.Lane = target == .origin ? .origin : .destination
        guard let action = searchActivity.begin(lane, access: access) else { return }
        invalidatePlace(target)
        searchPlaceRequests[target] = action.id
        defer { finishPlaceRequest(action, target: target) }
        do {
            let place = try await firebase.resolvePlace(uid: access.context.uid, placeId: suggestion.placeId)
            guard currentPlaceRequest(action, target: target) else { return }
            try PlaceSearchWire.validate(place)
            switch target {
            case .origin: searchOrigin = place
            case .destination: searchDestination = place
            }
        } catch {
            guard currentPlaceRequest(action, target: target) else { return }
            errorMessage = "Impossible de confirmer cette adresse. Réessayez."
        }
    }

    func prepareSearch(form: SearchFormState, access: AccountAccess) -> SearchRequestState.Request? {
        guard searchActivity.available(.matches, access: access) else { return nil }
        invalidateSearch()
        if let message = form.validationMessage { errorMessage = message; return nil }
        guard let origin = searchOrigin, let destination = searchDestination else {
            errorMessage = "Choisissez un départ et une destination dans les suggestions."
            return nil
        }
        let context = SearchRequestContext(owner: access.context, form: form, origin: origin, destination: destination)
        errorMessage = nil
        return searchRequests.begin(context)
    }

    func runSearch(_ request: SearchRequestState.Request) async {
        guard searchRequests.pending == request, let access = searchActivity.access, access.context == request.context.owner,
              let action = searchActivity.begin(.matches, access: access) else { return }
        defer {
            searchActivity.finish(action)
            if searchRequests.pending == request { searchRequests.invalidate() }
        }
        do {
            let matches = try await firebase.searchTripMatches(criteria: request.context.criteria)
            guard searchActivity.current(action), searchRequests.finish(request, owner: access.context, succeeded: true) else { return }
            searchMatches = matches
        } catch {
            guard searchActivity.current(action), searchRequests.finish(request, owner: access.context, succeeded: false) else { return }
            errorMessage = "Impossible de rechercher les trajets. Réessayez."
        }
    }

    func requestSearchMatch(_ match: TripMatchSummary, form: SearchFormState, access: AccountAccess) async {
        guard access.isCurrent, searchActivity.access?.context == access.context else { return }
        guard let origin = searchOrigin, let destination = searchDestination,
              searchRequests.permitsBooking(SearchRequestContext(owner: access.context, form: form, origin: origin, destination: destination)),
              searchMatches.contains(match), match.tripId == match.summary.id else {
            errorMessage = "Les options ont changé. Relancez la recherche avant de réserver."
            return
        }
        await requestBooking(trip: match.summary, childId: form.childUserId, seats: form.seatsNeeded, access: access)
    }

    private func currentPlaceRequest(_ action: SearchActivityState.Action, target: SearchPlaceTarget) -> Bool {
        searchActivity.current(action) && searchPlaceRequests[target] == action.id
    }

    private func finishPlaceRequest(_ action: SearchActivityState.Action, target: SearchPlaceTarget) {
        searchActivity.finish(action)
        if searchPlaceRequests[target] == action.id { searchPlaceRequests[target] = nil }
    }
}
