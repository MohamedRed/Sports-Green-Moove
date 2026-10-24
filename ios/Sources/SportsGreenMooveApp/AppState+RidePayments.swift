import Foundation

extension AppState {
    var hasPendingRidePayment: Bool { pendingRidePayment?.ownerUid == session?.uid && pendingRidePayment != nil }

    func payRide(_ booking: PayableBookingSummary) async {
        guard !ridePaymentBusy, !hasPendingRidePayment, let owner = session?.uid else { return }
        ridePaymentBusy = true
        errorMessage = nil
        noticeMessage = nil
        defer { ridePaymentBusy = false }
        do {
            let config = try await stripe.prepareRidePayment(bookingId: booking.id)
            guard session?.uid == owner else { return }
            let target = try RidePaymentTarget(ownerUid: owner, bookingId: booking.id, amountCents: booking.amountCents, config: config)
            let outcome = try await NativePaymentSheetFlow.present(config: config)
            guard session?.uid == owner else { return }
            switch outcome {
            case .completed:
                pendingRidePayment = target
                ridePaymentState = .pending
                noticeMessage = RidePaymentState.pending.message
                await readRidePayment(target)
            case .canceled:
                noticeMessage = "Fenêtre de paiement fermée."
            }
        } catch {
            if session?.uid == owner { errorMessage = error.localizedDescription }
        }
    }

    func verifyRidePayment() async {
        guard !ridePaymentBusy, let target = pendingRidePayment, session?.uid == target.ownerUid else { return }
        errorMessage = nil
        ridePaymentBusy = true
        defer { ridePaymentBusy = false }
        await readRidePayment(target)
    }

    private func readRidePayment(_ target: RidePaymentTarget) async {
        do {
            let state = try await stripe.ridePaymentStatus(bookingId: target.bookingId, paymentIntentId: target.paymentIntentId)
            guard session?.uid == target.ownerUid else { return }
            ridePaymentState = state
            noticeMessage = state.message
            if [.recorded, .failed, .canceled].contains(state) { pendingRidePayment = nil }
            if state == .recorded { await refreshAppData() }
        } catch {
            if session?.uid == target.ownerUid { errorMessage = error.localizedDescription }
        }
    }
}
