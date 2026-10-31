package be.sportgreenmoove.app.data

data class StripeConnectAccount(
    val accountId: String,
    val reused: Boolean = false,
)

data class StripeConnectAccountLink(
    val url: String,
    val expiresAt: String?,
)
