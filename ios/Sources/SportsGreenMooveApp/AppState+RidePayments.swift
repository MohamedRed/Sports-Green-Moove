import Foundation

extension AppState {
    var hasPendingRidePayment: Bool { pendingRidePayment?.ownerUid == session?.uid && pendingRidePayment != nil }

    func payRide(_ booking: PayableBookingSummary) async {
        guard let access = accountAccess else { return }
        await payRide(booking, access: access)
    }

    func payRide(_ booking: PayableBookingSummary, access: AccountAccess) async {
        guard !ridePaymentBusy, !hasPendingRidePayment, let owner = session?.uid,
              let work = access.begin() else { return }
        ridePaymentBusy = true
        errorMessage = nil
        noticeMessage = nil
        defer { ridePaymentBusy = false; access.finish(work) }
        do {
            let config = try await stripe.prepareRidePayment(bookingId: booking.id)
            try access.requireCurrent(work)
            guard session?.uid == owner else { return }
            let target = try RidePaymentTarget(ownerUid: owner, bookingId: booking.id, amountCents: booking.amountCents, config: config)
            let outcome = try await NativePaymentSheetFlow.present(config: config)
            try access.requireCurrent(work)
            guard session?.uid == owner else { return }
            switch outcome {
            case .completed:
                pendingRidePayment = target
                ridePaymentState = .pending
                noticeMessage = RidePaymentState.pending.message
                await readRidePayment(target, access: access, work: work)
            case .canceled:
                noticeMessage = "Fenêtre de paiement fermée."
            }
        } catch {
            if access.owns(work), session?.uid == owner { errorMessage = error.localizedDescription }
        }
    }

    func verifyRidePayment() async {
        guard let access = accountAccess else { return }
        await verifyRidePayment(access: access)
    }

    func verifyRidePayment(access: AccountAccess) async {
        guard !ridePaymentBusy, let target = pendingRidePayment, session?.uid == target.ownerUid,
              let work = access.begin() else { return }
        errorMessage = nil
        ridePaymentBusy = true
        defer { ridePaymentBusy = false; access.finish(work) }
        await readRidePayment(target, access: access, work: work)
    }

    private func readRidePayment(_ target: RidePaymentTarget, access: AccountAccess, work: AccountWork) async {
        do {
            let state = try await stripe.ridePaymentStatus(bookingId: target.bookingId, paymentIntentId: target.paymentIntentId)
            try access.requireCurrent(work)
            guard session?.uid == target.ownerUid else { return }
            ridePaymentState = state
            noticeMessage = state.message
            if [.recorded, .failed, .canceled].contains(state) { pendingRidePayment = nil }
            if state == .recorded { await refreshAppData(access: access) }
        } catch {
            if access.owns(work), session?.uid == target.ownerUid { errorMessage = error.localizedDescription }
        }
    }
}
