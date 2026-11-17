package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.services.RidePaymentCoordinator
import be.sportgreenmoove.app.services.StripePaymentsGateway
import be.sportgreenmoove.app.services.rememberStripePaymentSheetController
import com.stripe.android.paymentsheet.PaymentSheetResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class RidePaymentFlow(
    val busy: Boolean,
    val pending: Boolean,
    val verificationMessage: String,
    val pay: (PayableBookingSummary) -> Unit,
    val verify: () -> Unit,
)

@Composable
fun rememberSportsGreenMoovePaymentSheetController(
    scope: CoroutineScope,
    sessionUid: String?,
    gateway: StripePaymentsGateway,
    refreshAppData: suspend () -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String?) -> Unit,
): RidePaymentFlow {
    val currentUid by rememberUpdatedState(sessionUid)
    val refresh by rememberUpdatedState(refreshAppData)
    val error by rememberUpdatedState(setError)
    val notice by rememberUpdatedState(setNotice)
    val coordinator = remember(gateway) {
        RidePaymentCoordinator(gateway, { currentUid }, { notice(it) }, { error(it) }, { refresh() })
    }
    LaunchedEffect(sessionUid) { coordinator.accountChanged() }
    val sheet = rememberStripePaymentSheetController { result ->
        when (result) {
            is PaymentSheetResult.Completed -> { scope.launch { coordinator.checkoutCompleted() } }
            is PaymentSheetResult.Canceled -> coordinator.checkoutClosed()
            is PaymentSheetResult.Failed -> coordinator.checkoutClosed(result.error)
        }
    }
    return RidePaymentFlow(
        busy = coordinator.busy,
        pending = coordinator.hasPending,
        verificationMessage = coordinator.verificationMessage,
        verify = { scope.launch { coordinator.verify() }; Unit },
        pay = { booking ->
            scope.launch { coordinator.pay(booking.bookingId, booking.amountCents, sheet::present) }; Unit
        },
    )
}
