package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.StripeConnectCoordinator
import be.sportgreenmoove.app.services.StripeConnectOwner
import be.sportgreenmoove.app.services.stripeConnectUrls
import kotlinx.coroutines.launch

@Composable
fun PaymentsRoute(
    role: AppRole,
    sessionUid: String?,
    sessionEmail: String?,
    bookings: List<PayableBookingSummary>,
    loading: Boolean,
    providers: AndroidProviderSet,
    paymentSheet: RidePaymentFlow,
    onBack: () -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String?) -> Unit,
) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val urls = remember(context) { stripeConnectUrls(context.applicationContext) }
    val scope = rememberCoroutineScope()
    val owner by rememberUpdatedState(sessionUid?.let { StripeConnectOwner(it, sessionEmail, role) })
    val blocked by rememberUpdatedState(loading || paymentSheet.busy || paymentSheet.pending)
    val error by rememberUpdatedState(setError)
    val notice by rememberUpdatedState(setNotice)
    val connect = remember(providers.stripe) {
        StripeConnectCoordinator(providers.stripe, { owner }, { blocked }, { error(it) }, { notice(it) })
    }
    PaymentsScreen(
        role = role,
        bookings = bookings,
        loading = blocked || connect.busy,
        paymentPending = paymentSheet.pending,
        verificationMessage = paymentSheet.verificationMessage,
        verificationBusy = paymentSheet.busy,
        onVerifyPayment = paymentSheet.verify,
        onBack = onBack,
        onPay = { booking ->
            paymentSheet.pay(booking)
        },
        onStartConnect = {
            scope.launch { connect.start(urls, uriHandler::openUri) }
        },
    )
}
