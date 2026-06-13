package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.R

data class StripeConnectUrls(
    val returnUrl: String,
    val refreshUrl: String,
)

fun stripeConnectUrls(context: Context): StripeConnectUrls? {
    val returnUrl = context.getString(R.string.sgm_stripe_connect_return_url).trim()
    val refreshUrl = context.getString(R.string.sgm_stripe_connect_refresh_url).trim()
    return if (returnUrl.isNotEmpty() && refreshUrl.isNotEmpty()) {
        StripeConnectUrls(returnUrl = returnUrl, refreshUrl = refreshUrl)
    } else {
        null
    }
}
