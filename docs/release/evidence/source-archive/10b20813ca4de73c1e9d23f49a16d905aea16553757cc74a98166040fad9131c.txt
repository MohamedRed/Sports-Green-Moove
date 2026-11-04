import Foundation

struct RidePaymentTarget: Equatable, Sendable {
    let ownerUid: String
    let bookingId: String
    let paymentIntentId: String

    init(ownerUid: String, bookingId: String, amountCents: Int, config: PaymentSheetConfig) throws {
        guard !ownerUid.isEmpty, config.bookingId == bookingId, amountCents > 0, config.amountCents == amountCents,
              config.currency == "eur", config.paymentIntentId.hasPrefix("pi_"), !config.clientSecret.isEmpty, !config.publishableKey.isEmpty
        else { throw ProviderConfigurationError(message: "La préparation du paiement ne correspond pas à la réservation.") }
        self.ownerUid = ownerUid
        self.bookingId = bookingId
        self.paymentIntentId = config.paymentIntentId
    }
}

enum RidePaymentState: String, Sendable {
    case pending, recorded, failed, canceled, review
    var message: String {
        switch self {
        case .pending: "Paiement en cours de confirmation."
        case .recorded: "Paiement confirmé."
        case .failed: "Le paiement n'a pas abouti."
        case .canceled: "Le paiement a été annulé."
        case .review: "Le paiement reste à vérifier."
        }
    }
}

func mapRidePaymentState(_ payload: [String: Any], bookingId: String, paymentIntentId: String) throws -> RidePaymentState {
    guard payload["bookingId"] as? String == bookingId, payload["paymentIntentId"] as? String == paymentIntentId,
          let raw = payload["state"] as? String, let state = RidePaymentState(rawValue: raw)
    else { throw ProviderConfigurationError(message: "Réponse paiement invalide.") }
    return state
}
