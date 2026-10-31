import SwiftUI

private let publishCategories = ["U 5/6", "U 7/8", "U 9/10", "U 11/12", "U 13/14", "U 15/16", "Seniors", "Réserves"]
private let publishFrequencies = ["UNIQUE", "CHAQUE LUN", "CHAQUE MAR", "CHAQUE MER", "CHAQUE JEU", "CHAQUE VEN", "CHAQUE SAM", "CHAQUE DIM"]

struct PublishPlaceStep: View {
    let controller: PublishController
    @Binding var from: String
    @Binding var to: String
    let onSearchOrigin: () -> Void
    let onSearchDestination: () -> Void
    let onSelectOrigin: (PlaceSuggestion) -> Void
    let onSelectDestination: (PlaceSuggestion) -> Void
    let onNext: () -> Void

    var body: some View {
        PublishTitle("DÉPART & DESTINATION")
        PublishPlaceField(title: "Adresse de départ", icon: .location, text: $from, selected: controller.origin, suggestions: controller.originSuggestions, onSuggest: onSearchOrigin, onSelect: onSelectOrigin)
        PublishPlaceField(title: "Adresse de destination", icon: .flag, text: $to, selected: controller.destination, suggestions: controller.destinationSuggestions, onSuggest: onSearchDestination, onSelect: onSelectDestination)
        RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous)
            .fill(SGM.heroGradient)
            .frame(height: 110)
            .overlay(SGMGridTexture())
            .overlay(Text("GREEN SMARTMAP").font(.sgmDisplay(14)).tracking(.sgmWide(for: 14)).foregroundStyle(SGM.textOnGreen.opacity(0.42)))
        SGMButton(title: "SUIVANT", testID: UITestIdentifier.publishNextAction, action: onNext)
    }
}

struct PublishDetailsStep: View {
    @Binding var category: String
    @Binding var departureIso: String
    @Binding var returnTrip: Bool
    @Binding var childTracking: Bool
    @Binding var seats: Int
    @Binding var frequency: String
    @Binding var price: String
    let onNext: () -> Void

    var body: some View {
        PublishTitle("DÉTAILS DU TRAJET")
        PublishChoiceRow(label: "Catégorie", values: publishCategories, selected: $category)
        PublishTextRow(icon: .calendar, placeholder: "Date ISO", text: $departureIso)
        PublishToggleRow(label: "Aller - retour", selected: $returnTrip)
        PublishToggleRow(label: "Suivi enfant", selected: $childTracking)
        PublishSeatsRow(seats: $seats)
        PublishChoiceRow(label: "Fréquence", values: publishFrequencies, selected: $frequency)
        PublishTextRow(icon: .award, placeholder: "Prix estimé", text: $price)
        SGMButton(title: "SUIVANT", testID: UITestIdentifier.publishNextAction, action: onNext)
    }
}

struct PublishConfirmStep: View {
    let from: String
    let to: String
    let category: String
    let seats: Int
    let frequency: String
    let returnTrip: Bool
    let price: String
    let loading: Bool
    let onPublish: () -> Void

    var body: some View {
        PublishTitle("CONFIRMER")
        VStack(spacing: 0) {
            Text("FOOTBALL · \(category)")
                .font(.sgmDisplay(18))
                .tracking(.sgmWide(for: 18))
                .foregroundStyle(SGM.textOnGreen)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(SGM.heroGradient)
            VStack(spacing: 8) {
                summary("Départ", from)
                summary("Destination", to)
                summary("Places", "\(seats)")
                summary("Fréquence", frequency)
                summary("Aller-retour", returnTrip ? "Oui" : "Non")
                summary("Prix", price.isEmpty ? "Gratuit" : "\(price)€")
            }
            .padding(14)
        }
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
        SGMButton(title: loading ? "PUBLICATION..." : "PUBLIER CE TRAJET", testID: UITestIdentifier.publishSubmitAction, action: onPublish)
    }

    private func summary(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.sgmBody(13, weight: .medium))
                .foregroundStyle(SGM.textMuted)
            Spacer()
            Text(value.isEmpty ? "—" : value)
                .font(.sgmBody(13, weight: .bold))
                .foregroundStyle(SGM.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
    }
}
