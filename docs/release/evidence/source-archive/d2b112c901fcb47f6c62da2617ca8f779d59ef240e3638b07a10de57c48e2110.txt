import SwiftUI

struct ProfileReceivedRatings: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: ReceivedRatingsState
    init(access: AccountAccess, gateway: any ReceivedRatingsGateway) {
        _state = State(initialValue: ReceivedRatingsState(access: access, gateway: gateway))
    }
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            if state.live {
                if state.busy { ProgressView().accessibilityLabel("Chargement des avis reçus") }
                else if let summary = state.summary {
                    if let average = summary.average {
                        Label {
                            Text(average, format: .number.precision(.fractionLength(1))) + Text(" / 5")
                        } icon: { Image(systemName: "star.fill").foregroundStyle(SGM.orange) }
                            .font(.sgmBody(15, weight: .semibold)).accessibilityIdentifier("profile.rating.average")
                    }
                    Text(summary.count == 0 ? "Aucun avis reçu" : "\(summary.count.formatted()) avis reçu\(summary.count == 1 ? "" : "s")")
                        .font(.sgmBody(13)).foregroundStyle(SGM.textSecondary)
                        .fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("profile.rating.count")
                } else if let error = state.error {
                    Text(error).font(.sgmBody(13)).fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("profile.rating.error")
                }
                Spacer(minLength: 0)
                Button { Task { await state.refresh() } } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 44, height: 44)
                }.buttonStyle(.plain).disabled(state.busy).accessibilityLabel("Actualiser les avis reçus")
                    .help("Actualiser les avis reçus").accessibilityIdentifier("profile.rating.refresh")
            }
        }.foregroundStyle(SGM.textPrimary).frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .padding(.horizontal, SGMSpace.padScreen)
            .task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { state.suspend() } }
            .onDisappear { state.close() }
    }
}
