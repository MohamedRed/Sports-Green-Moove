package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.PaymentSheetConfig
import org.junit.Assert.*
import org.junit.Test

class RidePaymentVerificationTest {
    private val config = PaymentSheetConfig("booking", "pi_owned", "synthetic_secret", "pk_test_synthetic", 400, "eur")
    private fun rejects(block: () -> Unit) { try { block() } catch (_: Exception) { return }; fail("Unrelated payment accepted") }

    @Test fun bindsCheckoutToExactOwnerBookingAndFrozenAmount() {
        assertEquals(RidePaymentTarget("parent", "booking", "pi_owned"), ridePaymentTarget("parent", "booking", 400, config))
        for (changed in listOf(config.copy(bookingId = "other"), config.copy(amountCents = 401), config.copy(currency = "usd"),
            config.copy(clientSecret = ""), config.copy(paymentIntentId = "bad"))) {
            rejects { ridePaymentTarget("parent", "booking", 400, changed) }
        }
        rejects { ridePaymentTarget("", "booking", 400, config) }
    }

    @Test fun acceptsOnlyExplicitServerStatesForTheSameAttempt() {
        val payload = mapOf("bookingId" to "booking", "paymentIntentId" to "pi_owned", "state" to "recorded")
        assertEquals(RidePaymentState.Recorded, mapRidePaymentState(payload, "booking", "pi_owned"))
        assertEquals(RidePaymentState.Pending, mapRidePaymentState(payload + ("state" to "pending"), "booking", "pi_owned"))
        for (change in listOf("bookingId" to "other", "paymentIntentId" to "pi_other", "state" to "completed", "state" to ""))
            rejects { mapRidePaymentState(payload + change, "booking", "pi_owned") }
        rejects { mapRidePaymentState(payload - "state", "booking", "pi_owned") }
    }
}
