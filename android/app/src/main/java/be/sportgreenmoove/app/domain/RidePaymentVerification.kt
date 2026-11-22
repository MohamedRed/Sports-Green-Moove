package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.PaymentSheetConfig

data class RidePaymentTarget(val ownerUid: String, val bookingId: String, val paymentIntentId: String)

enum class RidePaymentState(val message: String) {
    Pending("Paiement en cours de confirmation."),
    Recorded("Paiement confirmé."),
    Failed("Le paiement n'a pas abouti."),
    Canceled("Le paiement a été annulé."),
    Review("Le paiement reste à vérifier."),
}

fun ridePaymentTarget(ownerUid: String, bookingId: String, amountCents: Int, config: PaymentSheetConfig): RidePaymentTarget {
    require(ownerUid.isNotBlank() && config.bookingId == bookingId && config.amountCents == amountCents && amountCents > 0 &&
        config.currency == "eur" && config.paymentIntentId.startsWith("pi_") && config.clientSecret.isNotBlank() && config.publishableKey.isNotBlank()) {
        "La préparation du paiement ne correspond pas à la réservation."
    }
    return RidePaymentTarget(ownerUid, bookingId, config.paymentIntentId)
}

fun mapRidePaymentState(payload: Map<*, *>, bookingId: String, paymentIntentId: String): RidePaymentState {
    require(payload["bookingId"] == bookingId && payload["paymentIntentId"] == paymentIntentId) { "Réponse paiement invalide." }
    return when (payload["state"]) {
        "pending" -> RidePaymentState.Pending
        "recorded" -> RidePaymentState.Recorded
        "failed" -> RidePaymentState.Failed
        "canceled" -> RidePaymentState.Canceled
        "review" -> RidePaymentState.Review
        else -> error("État du paiement invalide.")
    }
}
