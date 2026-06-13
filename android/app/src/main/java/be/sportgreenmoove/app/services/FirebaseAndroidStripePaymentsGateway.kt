package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.PaymentSheetConfig
import be.sportgreenmoove.app.data.StripeConnectAccount
import be.sportgreenmoove.app.data.StripeConnectAccountLink
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

class FirebaseAndroidStripePaymentsGateway : StripePaymentsGateway {
    private val functions = FirebaseFunctions.getInstance()
    override val isConfigured: Boolean = true

    override suspend fun createStripeAccount(email: String): StripeConnectAccount {
        val result = functions
            .getHttpsCallable("createStripeAccount")
            .call(mapOf("email" to email))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse compte Stripe invalide.")
        val accountId = payload["id"] as? String ?: throw ProviderConfigurationException("Compte Stripe manquant.")
        return StripeConnectAccount(
            accountId = accountId,
            reused = payload["reused"] as? Boolean ?: false,
        )
    }

    override suspend fun createStripeAccountLink(returnUrl: String, refreshUrl: String): StripeConnectAccountLink {
        val result = functions
            .getHttpsCallable("createStripeAccountLink")
            .call(mapOf("returnUrl" to returnUrl, "refreshUrl" to refreshUrl))
            .await()
        val payload = result.data as? Map<*, *> ?: throw ProviderConfigurationException("Réponse onboarding Stripe invalide.")
        return StripeConnectAccountLink(
            url = payload["url"] as? String ?: throw ProviderConfigurationException("Lien onboarding Stripe manquant."),
            expiresAt = payload["expiresAt"] as? String,
        )
    }

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
