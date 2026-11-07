import SwiftUI

struct PublishDriverRequiredCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("MODE CONDUCTEUR REQUIS")
                .font(.sgmDisplay(20))
                .tracking(.sgmWide(for: 20))
                .foregroundStyle(SGM.textPrimary)
            Text("Passez en rôle conducteur depuis le profil pour publier un trajet vérifié.")
                .font(.sgmBody(14, weight: .medium))
                .foregroundStyle(SGM.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

struct PublishStepper: View {
    let step: Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(1...3, id: \.self) { item in
                Text("\(item)")
                    .font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(item <= step ? SGM.textOnGreen : SGM.textMuted)
                    .frame(width: 28, height: 28)
                    .background(item <= step ? SGM.green : SGM.bgCard, in: Circle())
                    .overlay(Circle().stroke(SGM.border, lineWidth: 1))
                if item < 3 {
                    Capsule().fill(item < step ? SGM.green : SGM.border).frame(height: 3)
                }
            }
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 6)
    }
}

struct PublishTitle: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.sgmDisplay(20))
            .tracking(.sgmWide(for: 20))
            .foregroundStyle(SGM.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PublishChoiceRow: View {
    let label: String
    let values: [String]
    @Binding var selected: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.sgmBody(13, weight: .semibold))
                .foregroundStyle(SGM.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(values, id: \.self) { value in
                        SGMChip(text: value, selected: selected == value) {
                            selected = value
                        }
                        .frame(width: value.count > 8 ? 126 : 92)
                    }
                }
            }
        }
        .publishRowStyle()
    }
}

struct PublishTextRow: View {
    let icon: SGMIcon
    let placeholder: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 10) {
            SGMIconView(icon: icon, size: 18, color: SGM.green)
            TextField(placeholder, text: $text)
                .font(.sgmBody(14, weight: .medium))
                .foregroundStyle(SGM.textPrimary)
        }
        .publishRowStyle()
    }
}

struct PublishToggleRow: View {
    let label: String
    @Binding var selected: Bool

    var body: some View {
        HStack {
            Text(label)
                .font(.sgmBody(13, weight: .semibold))
                .foregroundStyle(SGM.textSecondary)
            Spacer()
            Button { selected.toggle() } label: {
                Capsule()
                    .fill(selected ? SGM.green : SGM.bgInput)
                    .frame(width: 44, height: 24)
                    .overlay(alignment: selected ? .trailing : .leading) {
                        Circle()
                            .fill(SGM.textOnGreen)
                            .frame(width: 18, height: 18)
                            .padding(3)
                    }
            }
            .buttonStyle(.plain)
        }
        .publishRowStyle()
    }
}

struct PublishSeatsRow: View {
    @Binding var seats: Int

    var body: some View {
        HStack {
            Text("Places disponibles")
                .font(.sgmBody(13, weight: .semibold))
                .foregroundStyle(SGM.textSecondary)
            Spacer()
            SGMCircleIconButton(icon: .chevronLeft, size: 28) {
                seats = max(1, seats - 1)
            }
            Text("\(seats)")
                .font(.sgmDisplay(22))
                .foregroundStyle(SGM.green)
                .frame(width: 24)
            SGMCircleIconButton(icon: .plus, size: 28) {
                seats = min(6, seats + 1)
            }
        }
        .publishRowStyle()
    }
}

private struct PublishRowStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private extension View {
    func publishRowStyle() -> some View {
        modifier(PublishRowStyle())
    }
}
