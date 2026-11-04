import SwiftUI

struct PaymentsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    private let access: AccountAccess
    @State private var controller: PaymentScreenController

    init(access: AccountAccess) {
        self.access = access
        _controller = State(initialValue: PaymentScreenController(access: access))
    }

    var body: some View {
        SGMScreen(testID: UITestIdentifier.paymentsScreen) {
            SGMTopBar(title: "PAIEMENTS", showsBack: true)
            PaymentsHero(bookings: appState.payableBookings)
            if appState.hasPendingRidePayment {
                VStack(alignment: .leading, spacing: 12) {
                    Text(appState.ridePaymentState.message)
                        .font(.sgmBody(13, weight: .medium))
                        .foregroundStyle(SGM.textPrimary)
                    SGMButton(title: appState.ridePaymentBusy ? "Vérification..." : "Vérifier le paiement") {
                        Task {
                            guard controller.acceptsAction else { return }
                            await appState.verifyRidePayment(access: access)
                        }
                    }
                    .disabled(appState.ridePaymentBusy || controller.loading)
                }.padding(.horizontal, SGMSpace.padScreen)
            }
            if appState.selectedRole == .driver {
                SGMSectionLabel("STRIPE CONNECT")
                PaymentsConnectCard(loading: appState.loading || appState.refreshingAppData || controller.loading || appState.ridePaymentBusy) {
                    Task {
                        await controller.startConnect(email: appState.session?.email, urls: NativeStripeConnectConfiguration.urls,
                            gateway: appState.stripe, openURL: { openURL($0) },
                            onError: { appState.errorMessage = $0 }, onNotice: { appState.noticeMessage = $0 })
                    }
                }
                .padding(.horizontal, SGMSpace.padScreen)
            }
            SGMSectionLabel("À RÉGLER")
            if appState.payableBookings.isEmpty {
                PaymentsEmptyCard()
                    .padding(.horizontal, SGMSpace.padScreen)
            } else {
                VStack(spacing: 10) {
                    ForEach(appState.payableBookings) { booking in
                        PaymentBookingCard(
                            booking: booking,
                            loading: appState.loading || appState.refreshingAppData || appState.ridePaymentBusy || appState.hasPendingRidePayment || controller.loading,
                            paymentPending: appState.hasPendingRidePayment
                        ) {
                            Task {
                                guard controller.acceptsAction else { return }
                                await appState.payRide(booking, access: access)
                            }
                        }
                    }
                }
                .padding(.horizontal, SGMSpace.padScreen)
            }
        }
        .task {
            controller.activate()
            guard controller.acceptsAction else { return }
            await appState.refreshAppData(access: access)
        }
        .onDisappear { controller.close() }
    }

}

private struct PaymentsConnectCard: View {
    let loading: Bool
    let action: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            SGMIconView(icon: .award, size: 20, color: SGM.orange)
                .frame(width: 42, height: 42)
                .background(SGM.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text("Stripe Connect")
                    .font(.sgmBody(15, weight: .semibold))
                    .foregroundStyle(SGM.textPrimary)
                Text("Activez les paiements conducteur et les futurs virements récompenses.")
                    .font(.sgmBody(12, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
                SGMButton(title: loading ? "Ouverture..." : "Continuer l'onboarding", action: action)
                    .opacity(loading ? 0.58 : 1)
                    .allowsHitTesting(!loading)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct PaymentsHero: View {
    let bookings: [PayableBookingSummary]

    private var totalCents: Int {
        bookings.reduce(0) { $0 + $1.amountCents }
    }

    var body: some View {
        ZStack(alignment: .leading) {
            SGM.heroGradient
            SGMGridTexture()
            VStack(alignment: .leading, spacing: 8) {
                Text(formatEuros(totalCents))
                    .font(.sgmDisplay(42))
                    .tracking(.sgmWide(for: 42))
                    .foregroundStyle(SGM.green)
                Text("\(bookings.count) réservation\(bookings.count > 1 ? "s" : "") approuvée\(bookings.count > 1 ? "s" : "") en attente de paiement.")
                    .font(.sgmBody(13, weight: .semibold))
                    .foregroundStyle(SGM.textOnGreen.opacity(0.68))
            }
            .padding(20)
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .padding(.horizontal, SGMSpace.padScreen)
    }
}

private struct PaymentBookingCard: View {
    let booking: PayableBookingSummary
    let loading: Bool
    let paymentPending: Bool
    let action: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                SGMAvatar(initials: String(booking.club.prefix(2)), size: 42)
                VStack(alignment: .leading, spacing: 3) {
                    Text(booking.title)
                        .font(.sgmBody(15, weight: .semibold))
                        .foregroundStyle(SGM.textPrimary)
                        .lineLimit(1)
                    Text("\(booking.dateLabel) · \(booking.timeLabel) · \(booking.seats) place\(booking.seats > 1 ? "s" : "")")
                        .font(.sgmBody(11, weight: .medium))
                        .foregroundStyle(SGM.textMuted)
                }
                Spacer()
                Text(booking.amountLabel)
                    .font(.sgmDisplay(22))
                    .foregroundStyle(SGM.orange)
            }
            SGMButton(title: paymentPending ? "Confirmation en attente" : loading ? "Préparation..." : "Payer maintenant", testID: UITestIdentifier.paymentAction, action: action)
                .opacity(loading ? 0.58 : 1)
                .allowsHitTesting(!loading)
        }
        .padding(16)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct PaymentsEmptyCard: View {
    var body: some View {
        HStack(spacing: 12) {
            SGMIconView(icon: .award, size: 20, color: SGM.green)
                .frame(width: 42, height: 42)
                .background(SGM.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text("Aucun paiement dû")
                    .font(.sgmBody(15, weight: .semibold))
                    .foregroundStyle(SGM.textPrimary)
                Text("Les réservations apparaissent ici après validation du conducteur.")
                    .font(.sgmBody(12, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private func formatEuros(_ cents: Int) -> String {
    String(format: "%.2f€", Double(cents) / 100).replacingOccurrences(of: ".", with: ",")
}
