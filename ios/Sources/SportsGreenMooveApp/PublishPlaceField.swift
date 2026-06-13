import SwiftUI

struct PublishPlaceField: View {
    let title: String
    let icon: SGMIcon
    @Binding var text: String
    let selected: ResolvedPlace?
    let suggestions: [PlaceSuggestion]
    let onSuggest: () -> Void
    let onSelect: (PlaceSuggestion) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                HStack(spacing: 10) {
                    SGMIconView(icon: icon, size: 18, color: SGM.green)
                    TextField(title, text: $text)
                        .font(.sgmBody(14, weight: .medium))
                        .foregroundStyle(SGM.textPrimary)
                }
                .padding(.horizontal, 14)
                .frame(height: 46)
                .background(SGM.bgInput, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1.5))

                SGMButton(title: "Chercher", variant: .ghost, full: false, action: onSuggest)
            }

            if let selected {
                Text(selected.formattedAddress)
                    .font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(SGM.green)
                    .lineLimit(2)
            }

            ForEach(suggestions.prefix(4)) { suggestion in
                Button { onSelect(suggestion) } label: {
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
    }
}
