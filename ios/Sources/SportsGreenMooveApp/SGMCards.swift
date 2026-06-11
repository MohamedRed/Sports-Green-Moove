import SwiftUI

struct SGMStatTile: View {
    let value: String
    let unit: String
    let label: String
    var accent = SGM.green

    var body: some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.sgmDisplay(30))
                .foregroundStyle(accent)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(unit)
                .font(.sgmBody(10, weight: .bold))
                .foregroundStyle(accent)
            Text(label)
                .font(.sgmBody(10, weight: .medium))
                .foregroundStyle(SGM.textMuted)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 80)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(SGM.border, lineWidth: 1)
        )
    }
}

struct SGMTripCard: View {
    let sport: String
    let title: String
    let date: String
    let time: String
    let distance: String
    let seats: String
    var passengers: [String] = []
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(sport.uppercased())
                        .font(.sgmDisplay(11))
                        .tracking(.sgmWider(for: 11))
                        .foregroundStyle(SGM.greenLight)
                    Spacer()
                    Text("\(date.uppercased()) · \(time)")
                        .font(.sgmBody(11, weight: .bold))
                        .foregroundStyle(SGM.textOnGreen.opacity(0.62))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(SGM.heroStart)

                VStack(alignment: .leading, spacing: 8) {
                    Text(title.uppercased())
                        .font(.sgmDisplay(18))
                        .tracking(.sgmWide(for: 18))
                        .foregroundStyle(SGM.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)

                    HStack(spacing: 14) {
                        meta(icon: .location, text: distance)
                        meta(icon: .groups, text: seats)
                        Spacer()
                        HStack(spacing: -6) {
                            ForEach(passengers, id: \.self) { initials in
                                SGMAvatar(initials: initials, size: 24)
                                    .overlay(Circle().stroke(SGM.bgCard, lineWidth: 2))
                            }
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
            }
            .background(SGM.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous)
                    .stroke(SGM.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func meta(icon: SGMIcon, text: String) -> some View {
        HStack(spacing: 4) {
            SGMIconView(icon: icon, size: 12, color: SGM.textMuted)
            Text(text)
                .font(.sgmBody(12, weight: .medium))
                .foregroundStyle(SGM.textMuted)
        }
    }
}

struct SGMProgressBar: View {
    var progress: CGFloat

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(SGM.border)
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [SGM.green, SGM.orange],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(0, min(progress, 1)) * proxy.size.width)
            }
        }
        .frame(height: 6)
    }
}
