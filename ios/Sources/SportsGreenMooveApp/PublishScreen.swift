import SwiftUI

struct PublishScreen: View {
    @State private var step = 1

    var body: some View {
        SGMScreen {
            SGMTopBar(title: "PUBLIER UN TRAJET")
            PublishStepper(step: step)
            VStack(spacing: 10) {
                formRow("Club", "Royal Ottignies")
                formRow("Catégorie", "U8 Nationaux")
                formRow("Date", "07 Novembre 2022")
                formRow("Heure de départ", "16h45")
                formRow("Places disponibles", "2")
                formRow("Bagage", "Moyen")
                toggleRow("Suivi enfant", enabled: true)
                toggleRow("Retour proposé", enabled: false)
            }
            .padding(.horizontal, SGMSpace.padScreen)

            SGMButton(title: step < 3 ? "CONTINUER" : "PUBLIER", action: {
                if step < 3 {
                    step += 1
                }
            })
            .padding(.horizontal, SGMSpace.padScreen)
        }
    }

    private func formRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.sgmBody(14, weight: .semibold))
                .foregroundStyle(SGM.textPrimary)
            Spacer()
            Text(value)
                .font(.sgmBody(13, weight: .bold))
                .foregroundStyle(SGM.green)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            SGMIconView(icon: .chevronRight, size: 12, color: SGM.textMuted)
        }
        .padding(16)
        .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }

    private func toggleRow(_ label: String, enabled: Bool) -> some View {
        HStack {
            Text(label)
                .font(.sgmBody(14, weight: .semibold))
                .foregroundStyle(SGM.textPrimary)
            Spacer()
            Capsule()
                .fill(enabled ? SGM.green : SGM.bgInput)
                .frame(width: 46, height: 28)
                .overlay(alignment: enabled ? .trailing : .leading) {
                    Circle()
                        .fill(SGM.textOnGreen)
                        .frame(width: 22, height: 22)
                        .padding(3)
                }
        }
        .padding(16)
        .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct PublishStepper: View {
    let step: Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(1...3, id: \.self) { item in
                HStack(spacing: 8) {
                    Text("\(item)")
                        .font(.sgmBody(12, weight: .bold))
                        .foregroundStyle(item <= step ? SGM.textOnGreen : SGM.textMuted)
                        .frame(width: 26, height: 26)
                        .background(item <= step ? SGM.green : SGM.bgCard, in: Circle())
                        .overlay(Circle().stroke(SGM.border, lineWidth: 1))
                    if item < 3 {
                        Capsule()
                            .fill(item < step ? SGM.green : SGM.border)
                            .frame(height: 4)
                    }
                }
            }
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 2)
    }
}
