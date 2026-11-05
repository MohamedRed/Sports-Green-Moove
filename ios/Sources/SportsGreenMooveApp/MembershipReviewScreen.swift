import SwiftUI

struct MembershipReviewScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: MembershipReviewState
    @State private var confirmation: MembershipConfirmation?
    init(access: AccountAccess, gateway: any MembershipGateway) {
        _state = State(initialValue: MembershipReviewState(access: access, gateway: gateway))
    }
    var body: some View {
        SGMScreen(testID: "membership.review.screen") {
            MembershipHeader(title: "ADHÉSIONS", busy: state.busy, back: {
                if state.club == nil { state.close(); dismiss() } else { Task { await state.back() } }
            }, refresh: { Task { await state.refresh() } })
            if state.live {
                VStack(alignment: .leading, spacing: 18) {
                    if let club = state.club { Text(club.name).font(.sgmBody(20, weight: .bold)).fixedSize(horizontal: false, vertical: true) }
                    if state.busy { ProgressView().accessibilityLabel("Vérification des adhésions") }
                    if let error = state.error { Text(error).accessibilityIdentifier("membership.review.error") }
                    if let error = state.writeError { Text(error).accessibilityIdentifier("membership.review.write-error") }
                    if state.requiresRefresh { Button("Actualiser les demandes") { Task { await state.refresh() } }.disabled(state.busy).frame(minHeight: 44) }
                    if state.club == nil {
                        if state.loaded && state.clubs.isEmpty && !state.hasMore { Text("Aucun club à gérer.") }
                        ForEach(state.clubs) { club in
                            Button { Task { await state.select(club) } } label: {
                                HStack { Text(club.name).fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading)
                                    Image(systemName: "chevron.right").frame(width: 24, height: 24) }
                                    .frame(minHeight: 44).contentShape(Rectangle())
                            }.buttonStyle(.plain).disabled(state.busy).accessibilityIdentifier("membership.review.club.\(club.id)")
                        }
                    } else {
                        if state.loaded && state.items.isEmpty && !state.hasMore { Text("Aucune adhésion.") }
                        ForEach(state.items) { row in
                            MembershipReviewRow(row: row, canDecide: state.canDecide) { decision in confirmation = .init(row: row, decision: decision) }
                        }
                    }
                    if state.hasMore { Button("Autres résultats") { Task { await state.more() } }.disabled(state.busy)
                        .frame(minHeight: 44).accessibilityIdentifier("membership.review.more") }
                }.font(.sgmBody(15)).foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
            }
        }.task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { confirmation = nil; state.suspend() } }
            .onChange(of: state.live) { _, live in if !live { confirmation = nil; dismiss() } }
            .onDisappear { confirmation = nil; state.suspend() }
            .alert(confirmation?.decision == .approve ? "Accepter l’adhésion ?" : "Refuser l’adhésion ?", isPresented: Binding(
                get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }), presenting: confirmation) { pending in
                    Button("Annuler", role: .cancel) { confirmation = nil }
                    Button(pending.decision == .approve ? "Accepter" : "Refuser") {
                        confirmation = nil
                        Task { if await state.decide(pending.row, decision: pending.decision) { await state.refresh() } }
                    }
                } message: { pending in Text(pending.row.name ?? "") }
    }
}

private struct MembershipConfirmation { let row: MembershipReview; let decision: MembershipDecision }
private struct MembershipReviewRow: View {
    let row: MembershipReview
    let canDecide: Bool
    let onDecision: (MembershipDecision) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(row.name ?? "Nom indisponible").font(.sgmBody(17, weight: .semibold)).fixedSize(horizontal: false, vertical: true)
            if let team = row.team { Text(team).font(.sgmBody(13)) }
            Text(ClubMembership(role: row.role, status: row.status, active: row.active).label)
                .font(.sgmBody(13)).accessibilityIdentifier("membership.review.status.\(row.id)")
            if row.canDecide {
                HStack(spacing: 12) {
                    Button { onDecision(.approve) } label: { Image(systemName: "checkmark").frame(width: 44, height: 44) }
                        .accessibilityLabel("Accepter l’adhésion").help("Accepter l’adhésion").accessibilityIdentifier("membership.approve.\(row.id)")
                    Button { onDecision(.reject) } label: { Image(systemName: "xmark").frame(width: 44, height: 44) }
                        .accessibilityLabel("Refuser l’adhésion").help("Refuser l’adhésion").accessibilityIdentifier("membership.reject.\(row.id)")
                }.buttonStyle(.plain).disabled(!canDecide)
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}
