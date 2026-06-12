package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.PaymentSheetConfig
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

class FirebaseAndroidStripePaymentsGateway : StripePaymentsGateway {
    private val functions = FirebaseFunctions.getInstance()
    override val isConfigured: Boolean = true

    override suspend fun prepareRidePayment(bookingId: String): PaymentSheetConfig {
        val result = functions
            .getHttpsCallable("createRidePaymentIntent")
            .call(mapOf("bookingId" to bookingId))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse paiement invalide.")
        return mapPaymentSheetConfig(payload)
    }
}

private fun mapPaymentSheetConfig(payload: Map<*, *>): PaymentSheetConfig {
    val bookingId = payload["bookingId"] as? String
    val paymentIntentId = payload["paymentIntentId"] as? String
    val clientSecret = payload["clientSecret"] as? String
    val publishableKey = payload["publishableKey"] as? String
    val amountCents = (payload["amountCents"] as? Number)?.toInt()
    val currency = payload["currency"] as? String

    if (
        bookingId == null ||
        paymentIntentId == null ||
        clientSecret == null ||
        publishableKey == null ||
        amountCents == null ||
        currency == null
    ) {
        throw ProviderConfigurationException("Configuration PaymentSheet incomplète.")
    }

    return PaymentSheetConfig(
        bookingId = bookingId,
        paymentIntentId = paymentIntentId,
        clientSecret = clientSecret,
        publishableKey = publishableKey,
        amountCents = amountCents,
        currency = currency,
    )
}
