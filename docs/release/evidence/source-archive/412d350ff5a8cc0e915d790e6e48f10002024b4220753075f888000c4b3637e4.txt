package be.sportgreenmoove.app.services

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.PaymentSheetConfig
import be.sportgreenmoove.app.domain.*
import kotlinx.coroutines.CancellationException

class RidePaymentCoordinator(
    private val gateway: StripePaymentsGateway,
    private val currentUid: () -> String?,
    private val notice: (String?) -> Unit,
    private val error: (String?) -> Unit,
    private val refresh: suspend () -> Unit,
) {
    private var preparing by mutableStateOf(false)
    private var checking by mutableStateOf(false)
    private var checkout by mutableStateOf<RidePaymentTarget?>(null)
    private var pending by mutableStateOf<RidePaymentTarget?>(null)
    var verificationMessage by mutableStateOf(RidePaymentState.Pending.message)
        private set
    val busy: Boolean get() = preparing || checking || checkout != null
    val hasPending: Boolean get() = pending?.let { it.ownerUid == currentUid() } == true
    fun accountChanged() { if (!hasPending) pending = null }

    suspend fun pay(bookingId: String, amountCents: Int, present: (PaymentSheetConfig) -> Unit) {
        val owner = currentUid() ?: return
        if (busy || hasPending) return
        error(null)
        notice(null)
        preparing = true
        try {
            val config = gateway.prepareRidePayment(bookingId)
            if (currentUid() != owner) return
            checkout = ridePaymentTarget(owner, bookingId, amountCents, config)
            present(config)
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            checkout = null
            if (currentUid() == owner) error(UserFacingErrorPolicy.messageFor(failure))
        } finally { preparing = false }
    }

    suspend fun checkoutCompleted() {
        val target = checkout ?: return
        checkout = null
        if (currentUid() != target.ownerUid) return
        pending = target
        verificationMessage = RidePaymentState.Pending.message
        notice(RidePaymentState.Pending.message)
        verify()
    }

    fun checkoutClosed(failure: Throwable? = null) {
        val target = checkout ?: return
        checkout = null
        if (currentUid() != target.ownerUid) return
        if (failure != null) error(UserFacingErrorPolicy.messageFor(failure))
        else notice("Fenêtre de paiement fermée.")
    }

    suspend fun verify() {
        val target = pending ?: return
        if (checking || currentUid() != target.ownerUid) return
        error(null)
        checking = true
        try {
            val state = gateway.ridePaymentStatus(target.bookingId, target.paymentIntentId)
            if (currentUid() != target.ownerUid) return
            verificationMessage = state.message
            notice(state.message)
            if (state in listOf(RidePaymentState.Recorded, RidePaymentState.Failed, RidePaymentState.Canceled)) pending = null
            if (state == RidePaymentState.Recorded) refresh()
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            if (currentUid() == target.ownerUid) error(UserFacingErrorPolicy.messageFor(failure))
        } finally { checking = false }
    }
}
