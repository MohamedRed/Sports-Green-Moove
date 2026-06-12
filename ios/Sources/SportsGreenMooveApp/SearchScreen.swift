import SwiftUI

struct SearchScreen: View {
    @Environment(AppState.self) private var appState
    @State private var originInput = ""
    @State private var destinationInput = ""
    @State private var departureIso = ISO8601DateFormatter().string(from: Date().addingTimeInterval(86_400))
    @State private var seatsNeeded = 1
    @State private var baggage = "medium"
    @State private var returnTrip = false
    @State private var childTracking = true
    @State private var guardianConsent = true

    var body: some View {
        SGMScreen(spacing: 10) {
            SGMTopBar(title: "RECHERCHE", showsBack: true)
            VStack(spacing: 10) {
                PlaceSearchField(
                    title: "Départ",
                    text: $originInput,
                    selected: appState.searchOrigin,
                    suggestions: appState.originSuggestions,
                    onSuggest: { Task { await appState.suggestPlaces(input: originInput, target: .origin) } },
                    onSelect: { suggestion in Task { await appState.selectPlace(suggestion, target: .origin) } }
                )
                PlaceSearchField(
                    title: "Destination",
                    text: $destinationInput,
                    selected: appState.searchDestination,
                    suggestions: appState.destinationSuggestions,
                    onSuggest: { Task { await appState.suggestPlaces(input: destinationInput, target: .destination) } },
                    onSelect: { suggestion in Task { await appState.selectPlace(suggestion, target: .destination) } }
                )
                SearchTextField(title: "Date ISO", text: $departureIso)
                SearchOptions(
                    seatsNeeded: $seatsNeeded,
                    baggage: $baggage,
                    returnTrip: $returnTrip,
                    childTracking: $childTracking,
                    guardianConsent: $guardianConsent
                )
                SGMButton(title: appState.searchLoading ? "RECHERCHE EN COURS" : "TROUVER UN TRAJET") {
                    Task {
                        await appState.runSearch(
                            form: SearchFormState(
                                desiredDepartureAtIso: departureIso,
                                seatsNeeded: seatsNeeded,
                                baggage: baggage,
                                returnTrip: returnTrip,
                                requireChildTracking: childTracking,
                                guardianConsent: guardianConsent
                            )
                        )
                    }
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)

            SGMSectionLabel("\(appState.searchMatches.count) match\(appState.searchMatches.count > 1 ? "s" : "")")
            VStack(spacing: 8) {
                ForEach(appState.searchMatches) { match in
                    MatchCard(match: match) {
                        Task { await appState.requestSearchMatch(match) }
                    }
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
    }
}

private struct PlaceSearchField: View {
    let title: String
    @Binding var text: String
    let selected: ResolvedPlace?
    let suggestions: [PlaceSuggestion]
    let onSuggest: () -> Void
    let onSelect: (PlaceSuggestion) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                SearchTextField(title: title, text: $text)
                SGMButton(title: "Chercher", variant: .ghost, full: false, action: onSuggest)
            }
            if let selected {
                Text(selected.formattedAddress)
                    .font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(SGM.green)
                    .lineLimit(2)
            }
            ForEach(suggestions.prefix(4)) { suggestion in
                SuggestionRow(suggestion: suggestion) { onSelect(suggestion) }
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
                    SGMChip(text: "\(seats) place\(seats > 1 ? "s" : "")", selected: seatsNeeded == seats) { seatsNeeded = seats }
                }
            }
            HStack(spacing: 6) {
                SearchOptionChip(title: "Petit", value: "small", selection: $baggage)
                SearchOptionChip(title: "Moyen", value: "medium", selection: $baggage)
                SearchOptionChip(title: "Grand", value: "large", selection: $baggage)
            }
            HStack(spacing: 6) {
                SGMChip(text: "Retour", selected: returnTrip) { returnTrip.toggle() }
                SGMChip(text: "Suivi enfant", selected: childTracking) { childTracking.toggle() }
                SGMChip(text: "Consentement", selected: guardianConsent) { guardianConsent.toggle() }
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
                SGMButton(title: "Demander", full: false, action: action)
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
