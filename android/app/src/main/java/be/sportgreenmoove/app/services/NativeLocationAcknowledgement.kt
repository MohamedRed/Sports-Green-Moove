package be.sportgreenmoove.app.services

internal fun requireNativeLocationAcknowledgement(response: Any?, update: Map<String, Any>) {
    fun invalid(): Nothing = throw ProviderConfigurationException("Position GPS non confirmée. Réessayez.")
    fun integer(value: Any?): Long {
        val number = (value as? Number)?.toDouble() ?: invalid()
        if (!number.isFinite() || number < 0 || number > 9_007_199_254_740_991.0 || number % 1.0 != 0.0) invalid()
        return number.toLong()
    }
    val envelope = response as? Map<*, *> ?: invalid()
    val written = integer(envelope["written"]); val ignored = integer(envelope["ignored"])
    if (written + ignored != 1L) invalid()
    val receipt = (envelope["receipts"] as? List<*>)?.singleOrNull() as? Map<*, *> ?: invalid()
    if (receipt["rideSessionId"] != update["rideSessionId"] || receipt["role"] != update["role"]) invalid()
    if (integer(receipt["capturedAt"]) != integer(update["capturedAt"]) || integer(update["capturedAt"]) == 0L) invalid()
    when (receipt["status"]) {
        "written" -> if (written != 1L || ignored != 0L) invalid()
        "retained" -> if (written != 0L || ignored != 1L) invalid()
        else -> invalid()
    }
}
