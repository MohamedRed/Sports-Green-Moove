package be.sportgreenmoove.app.services

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import be.sportgreenmoove.app.data.PaymentSheetConfig
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult

class StripePaymentSheetController(
    private val context: Context,
    private val paymentSheet: PaymentSheet,
) {
    fun present(config: PaymentSheetConfig) {
        PaymentConfiguration.init(context, config.publishableKey)
        paymentSheet.presentWithPaymentIntent(
            paymentIntentClientSecret = config.clientSecret,
            configuration = PaymentSheet.Configuration.Builder("Sports Green-mOOVe").build(),
        )
    }
}

@Composable
fun rememberStripePaymentSheetController(
    onResult: (PaymentSheetResult) -> Unit,
): StripePaymentSheetController {
    val context = LocalContext.current
    val paymentSheet = PaymentSheet.Builder { result -> onResult(result) }.build()
    return remember(context, paymentSheet) {
        StripePaymentSheetController(context = context, paymentSheet = paymentSheet)
    }
}
