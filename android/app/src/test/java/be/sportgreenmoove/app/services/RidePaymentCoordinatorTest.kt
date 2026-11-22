package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.PaymentSheetConfig
import be.sportgreenmoove.app.domain.RidePaymentState
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class RidePaymentCoordinatorTest {
    private class Gateway : StripePaymentsGateway by UnconfiguredStripePaymentsGateway() {
        var preparations = 0
        var reads = 0
        var state = RidePaymentState.Pending
        var readFailure = false
        var preparationGate: CompletableDeferred<Unit>? = null
        var statusGate: CompletableDeferred<Unit>? = null
        override suspend fun prepareRidePayment(bookingId: String): PaymentSheetConfig {
            preparations++; preparationGate?.await()
            return PaymentSheetConfig(bookingId, "pi_owned", "synthetic", "pk_test_synthetic", 400, "eur")
        }
        override suspend fun ridePaymentStatus(bookingId: String, paymentIntentId: String): RidePaymentState {
            reads++; statusGate?.await()
            if (readFailure) throw IOException()
            return state
        }
    }
    private class Harness {
        val gateway = Gateway()
        var uid: String? = "parent"
        var refreshes = 0
        var presentations = 0
        var refreshFailure = false
        val notices = mutableListOf<String>()
        val errors = mutableListOf<String>()
        var currentError: String? = null
        val coordinator = RidePaymentCoordinator(gateway, { uid }, { if (it != null) notices.add(it) }, {
            currentError = it; if (it != null) errors.add(it)
        }, {
            refreshes++; if (refreshFailure) throw IOException()
        })
        suspend fun pay() = coordinator.pay("booking", 400) { presentations++ }
    }

    @Test fun completedCheckoutStaysPendingUntilTheServerRecordsItWithoutAnotherCharge() = runBlocking {
        val h = Harness(); h.pay(); h.coordinator.checkoutCompleted()
        assertTrue(h.coordinator.hasPending); assertEquals(0, h.refreshes)
        assertFalse(h.notices.contains(RidePaymentState.Recorded.message))
        h.pay(); assertEquals(1, h.gateway.preparations); assertEquals(1, h.presentations)
        h.gateway.state = RidePaymentState.Recorded; h.coordinator.verify()
        assertFalse(h.coordinator.hasPending); assertEquals(1, h.refreshes)
        assertEquals(RidePaymentState.Recorded.message, h.notices.last()); assertEquals(1, h.gateway.preparations)
    }
    @Test fun readFailureKeepsAnExplicitReadOnlyRetry() = runBlocking {
        val h = Harness(); h.pay(); h.gateway.readFailure = true; h.coordinator.checkoutCompleted()
        assertTrue(h.coordinator.hasPending); assertEquals(1, h.errors.size)
        h.gateway.readFailure = false; h.gateway.state = RidePaymentState.Recorded; h.coordinator.verify()
        assertEquals(1, h.gateway.preparations); assertFalse(h.coordinator.hasPending)
        assertNull(h.currentError)
    }
    @Test fun refreshFailureCannotChangeARecordedPaymentBackToUnconfirmed() = runBlocking {
        val h = Harness(); h.pay(); h.refreshFailure = true; h.gateway.state = RidePaymentState.Recorded
        h.coordinator.checkoutCompleted()
        assertEquals(RidePaymentState.Recorded.message, h.notices.last()); assertFalse(h.coordinator.hasPending)
        assertEquals(1, h.errors.size)
    }
    @Test fun closingCheckoutDoesNotClaimProviderCancellationOrSuccess() = runBlocking {
        val h = Harness(); h.pay(); h.coordinator.checkoutClosed()
        assertEquals(listOf("Fenêtre de paiement fermée."), h.notices)
        assertEquals(0, h.gateway.reads); assertFalse(h.coordinator.hasPending)
    }
    @Test fun switchingAccountsDuringPreparationCannotOpenCheckoutForTheNextUser() = runBlocking {
        val h = Harness(); h.gateway.preparationGate = CompletableDeferred()
        val job = launch { h.pay() }; yield(); h.uid = "other"; h.coordinator.accountChanged()
        h.gateway.preparationGate!!.complete(Unit); job.join()
        assertEquals(0, h.presentations); assertTrue(h.notices.isEmpty()); assertFalse(h.coordinator.busy)
    }
    @Test fun switchingAccountsDuringTheStatusReadIgnoresTheOldResult() = runBlocking {
        val h = Harness(); h.pay(); h.gateway.state = RidePaymentState.Recorded; h.gateway.statusGate = CompletableDeferred()
        val job = launch { h.coordinator.checkoutCompleted() }; yield()
        h.uid = "other"; h.coordinator.accountChanged(); h.gateway.statusGate!!.complete(Unit); job.join()
        assertFalse(h.coordinator.hasPending); assertEquals(0, h.refreshes)
        assertFalse(h.notices.contains(RidePaymentState.Recorded.message))
    }
    @Test fun lateCheckoutCallbackCannotConfirmAnotherAccount() = runBlocking {
        val h = Harness(); h.pay(); h.uid = "other"; h.coordinator.accountChanged(); h.coordinator.checkoutCompleted()
        assertEquals(0, h.gateway.reads); assertTrue(h.notices.isEmpty()); assertFalse(h.coordinator.hasPending)
    }
    @Test fun repeatedTapsDuringAReadNeverPrepareAnotherPayment() = runBlocking {
        val h = Harness(); h.pay(); h.gateway.statusGate = CompletableDeferred()
        val job = launch { h.coordinator.checkoutCompleted() }; yield()
        h.pay(); h.coordinator.verify(); assertEquals(1, h.gateway.reads); assertEquals(1, h.gateway.preparations)
        h.gateway.statusGate!!.complete(Unit); job.join()
    }
}
