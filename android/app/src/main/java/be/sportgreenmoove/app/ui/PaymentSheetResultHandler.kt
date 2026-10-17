package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.StripePaymentSheetController
import be.sportgreenmoove.app.services.rememberStripePaymentSheetController
import com.stripe.android.paymentsheet.PaymentSheetResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun rememberSportsGreenMoovePaymentSheetController(
    scope: CoroutineScope,
    refreshAppData: suspend () -> Unit,
    setError: (String) -> Unit,
    setNotice: (String) -> Unit,
): StripePaymentSheetController =
    rememberStripePaymentSheetController { result ->
        when (result) {
            is PaymentSheetResult.Completed -> {
                setNotice("Paiement confirmé.")
                scope.launch {
                    runCatching { refreshAppData() }.onFailure {
                        setError(UserFacingErrorPolicy.messageFor(it))
                    }
                }
            }
            is PaymentSheetResult.Canceled -> {
                setNotice("Paiement annulé.")
            }
            is PaymentSheetResult.Failed -> {
                setError(UserFacingErrorPolicy.messageFor(result.error))
            }
        }
    }
