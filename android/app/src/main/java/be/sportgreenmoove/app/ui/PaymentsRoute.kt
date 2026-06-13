package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.StripePaymentSheetController
import be.sportgreenmoove.app.services.stripeConnectUrls
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun PaymentsRoute(
    role: AppRole,
    sessionEmail: String?,
    bookings: List<PayableBookingSummary>,
    loading: Boolean,
    providers: AndroidProviderSet,
    paymentSheet: StripePaymentSheetController,
    scope: CoroutineScope,
    onBack: () -> Unit,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String) -> Unit,
) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val urls = remember(context) { stripeConnectUrls(context.applicationContext) }
    PaymentsScreen(
        role = role,
        bookings = bookings,
        loading = loading,
        onBack = onBack,
        onPay = { booking ->
            launchPayment(scope, providers, paymentSheet, booking, setLoading, setError)
        },
        onStartConnect = {
            launchStripeConnectOnboarding(
                scope = scope,
                providers = providers,
                email = sessionEmail,
                returnUrl = urls?.returnUrl,
                refreshUrl = urls?.refreshUrl,
                openUrl = uriHandler::openUri,
                setLoading = setLoading,
                setError = setError,
                setNotice = setNotice,
            )
        },
    )
}

private fun launchStripeConnectOnboarding(
    scope: CoroutineScope,
    providers: AndroidProviderSet,
    email: String?,
    returnUrl: String?,
    refreshUrl: String?,
    openUrl: (String) -> Unit,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String) -> Unit,
) {
    scope.launch {
        val driverEmail = email?.takeIf(String::isNotBlank)
        if (driverEmail == null) {
            setError("Adresse email Firebase requise pour Stripe Connect.")
            return@launch
        }
        if (returnUrl.isNullOrBlank() || refreshUrl.isNullOrBlank()) {
            setError("Configurez SGM_STRIPE_CONNECT_RETURN_URL et SGM_STRIPE_CONNECT_REFRESH_URL.")
            return@launch
        }
        setLoading(true)
        setError(null)
        runCatching {
            val account = providers.stripe.createStripeAccount(driverEmail)
            val link = providers.stripe.createStripeAccountLink(returnUrl, refreshUrl)
            openUrl(link.url)
            setNotice(if (account.reused) "Onboarding Stripe repris." else "Compte Stripe créé.")
        }.onFailure { setError(it.message) }
        setLoading(false)
    }
}
