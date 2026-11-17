import SwiftUI

struct SearchScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var phase
    @State private var selection: SearchSelectionState
    let access: AccountAccess

    init(appState: AppState, access: AccountAccess) {
        self.access = access
        _selection = State(initialValue: SearchSelectionState(appState: appState, access: access))
    }

    var body: some View {
        @Bindable var selection = selection
        SGMScreen(spacing: 10, testID: UITestIdentifier.searchScreen) {
            SGMTopBar(title: "RECHERCHE", showsBack: true)
            VStack(spacing: 10) {
                PlaceSearchField(
                    title: "Départ",
                    text: $selection.originInput,
                    selected: appState.searchOrigin,
                    suggestions: appState.originSuggestions,
                    busy: !appState.searchActivity.available(.origin, access: access),
                    onSuggest: {
                        let input = selection.originInput
                        Task { await appState.suggestPlaces(input: input, target: .origin, access: access) }
                    },
                    onSelect: { suggestion in Task { await appState.selectPlace(suggestion, target: .origin, access: access) } }
                )
                PlaceSearchField(
                    title: "Destination",
                    text: $selection.destinationInput,
                    selected: appState.searchDestination,
                    suggestions: appState.destinationSuggestions,
                    busy: !appState.searchActivity.available(.destination, access: access),
                    onSuggest: {
                        let input = selection.destinationInput
                        Task { await appState.suggestPlaces(input: input, target: .destination, access: access) }
                    },
                    onSelect: { suggestion in Task { await appState.selectPlace(suggestion, target: .destination, access: access) } }
                )
                SearchTextField(title: "Date ISO", text: $selection.form.desiredDepartureAtIso)
                SearchChildSelector(
                    children: appState.children,
                    selectedChildId: $selection.form.childUserId
                )
                SearchOptions(
                    seatsNeeded: $selection.form.seatsNeeded,
                    baggage: $selection.form.baggage,
                    returnTrip: $selection.form.returnTrip,
                    childTracking: $selection.form.requireChildTracking,
                    guardianConsent: $selection.form.guardianConsent
                )
                SGMButton(title: appState.searchLoading ? "RECHERCHE EN COURS" : "TROUVER UN TRAJET", testID: UITestIdentifier.searchAction) {
                    if let request = appState.prepareSearch(form: selection.form, access: access) {
                        Task { await appState.runSearch(request) }
                    }
                }
                .disabled(!appState.searchActivity.available(.matches, access: access))
            }
            .padding(.horizontal, SGMSpace.padScreen)

            SGMSectionLabel("\(appState.searchMatches.count) match\(appState.searchMatches.count > 1 ? "s" : "")")
            VStack(spacing: 8) {
                ForEach(appState.searchMatches) { match in
                    MatchCard(match: match) {
                        let submittedForm = selection.form
                        Task { await appState.requestSearchMatch(match, form: submittedForm, access: access) }
                    }
                    .disabled(appState.bookingBusy || appState.searchActivity.access?.context != access.context)
                }
                if !appState.searchLoading && appState.searchMatches.isEmpty {
                    Text("Choisissez un départ, une destination et lancez la recherche.")
                        .font(.sgmBody(14, weight: .medium))
                        .foregroundStyle(SGM.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 24)
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)
        }
        .onAppear {
            selection.reconcileChildren(appState.children)
        }
        .onChange(of: appState.children) { _, children in
            selection.reconcileChildren(children)
        }
        .onChange(of: appState.session?.uid) { _, _ in
            selection.reset(children: appState.children)
        }
        .task(id: SearchSceneKey(phase: phase, waiting: access.waitingForEarlierWork)) {
            if phase == .active && !access.waitingForEarlierWork { appState.activateSearch(access: access) }
            else { appState.suspendSearch(access: access) }
        }
        .onChange(of: phase) { _, next in if next != .active { appState.suspendSearch(access: access) } }
        .onDisappear { appState.suspendSearch(access: access) }
    }

}

private struct SearchSceneKey: Equatable { let phase: ScenePhase; let waiting: Bool }

private struct PlaceSearchField: View {
    let title: String
    @Binding var text: String
    let selected: ResolvedPlace?
    let suggestions: [PlaceSuggestion]
    let busy: Bool
    let onSuggest: () -> Void
    let onSelect: (PlaceSuggestion) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                SearchTextField(title: title, text: $text)
                SGMButton(title: "Chercher", variant: .ghost, full: false, action: onSuggest)
                    .disabled(busy)
            }
            if let selected {
                Text(selected.formattedAddress)
                    .font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(SGM.green)
                    .lineLimit(2)
            }
            ForEach(suggestions.prefix(4)) { suggestion in
                SuggestionRow(suggestion: suggestion) { onSelect(suggestion) }
                    .disabled(busy)
            }
        }
    }
}

private struct SearchTextField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        TextField(title, text: $text)
            .font(.sgmBody(14, weight: .medium))
            .foregroundStyle(SGM.textPrimary)
            .padding(.horizontal, 14)
            .frame(height: 46)
            .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct SuggestionRow: View {
    let suggestion: PlaceSuggestion
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                SGMIconView(icon: .location, size: 16, color: SGM.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text(suggestion.mainText ?? suggestion.label)
                        .font(.sgmBody(13, weight: .bold))
                        .foregroundStyle(SGM.textPrimary)
                        .lineLimit(1)
                    if let secondaryText = suggestion.secondaryText {
                        Text(secondaryText)
                            .font(.sgmBody(11, weight: .medium))
                            .foregroundStyle(SGM.textMuted)
                            .lineLimit(1)
                    }
                }
                Spacer()
            }
            .padding(12)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(SGM.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

private struct SearchOptions: View {
    @Binding var seatsNeeded: Int
    @Binding var baggage: String
    @Binding var returnTrip: Bool
    @Binding var childTracking: Bool
    @Binding var guardianConsent: Bool

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                ForEach([1, 2, 3], id: \.self) { seats in
                    SGMChip(text: "\(seats) place\(seats > 1 ? "s" : "")", selected: seatsNeeded == seats,
                        testID: "search.seats.\(seats)") { seatsNeeded = seats }
                }
            }
            HStack(spacing: 6) {
                SearchOptionChip(title: "Petit", value: "small", selection: $baggage)
                SearchOptionChip(title: "Moyen", value: "medium", selection: $baggage)
                SearchOptionChip(title: "Grand", value: "large", selection: $baggage)
            }
            HStack(spacing: 6) {
                SGMChip(text: "Retour", selected: returnTrip) { returnTrip.toggle() }
                SGMChip(text: "Suivi enfant", selected: childTracking, testID: "search.child-tracking") { childTracking.toggle() }
                    .accessibilityValue(childTracking ? "Activé" : "Désactivé")
                SGMChip(text: "Consentement", selected: guardianConsent, testID: "search.consent") { guardianConsent.toggle() }
                    .accessibilityValue(guardianConsent ? "Accordé" : "Non accordé")
            }
        }
    }
}

private struct SearchOptionChip: View {
    let title: String
    let value: String
    @Binding var selection: String

    var body: some View {
        SGMChip(text: title, selected: selection == value) {
            selection = value
        }
    }
}

private struct MatchCard: View {
    let match: TripMatchSummary
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(match.summary.sport.uppercased())
                    .font(.sgmBody(11, weight: .bold))
                    .tracking(.sgmWide(for: 11))
                    .foregroundStyle(SGM.green)
                Spacer()
                Text(match.summary.departureLabel)
                    .font(.sgmBody(11, weight: .semibold))
                    .foregroundStyle(SGM.textMuted)
            }
            Text(match.summary.title)
                .font(.sgmDisplay(17))
                .tracking(.sgmWide(for: 17))
                .foregroundStyle(SGM.textPrimary)
                .lineLimit(1)
            HStack(spacing: 8) {
                Text(match.summary.seatsLabel)
                Text(match.summary.priceLabel)
                if let detourMinutes = match.detourMinutes {
                    Text("+\(detourMinutes) min détour")
                }
                Spacer()
                SGMButton(title: "Demander", full: false, testID: UITestIdentifier.bookingRequestAction, action: action)
            }
            .font(.sgmBody(12, weight: .semibold))
            .foregroundStyle(SGM.textSecondary)
            Text(match.reasons.prefix(3).joined(separator: " · "))
                .font(.sgmBody(12, weight: .medium))
                .foregroundStyle(SGM.textMuted)
                .lineLimit(2)
        }
        .padding(14)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}
