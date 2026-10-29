package be.sportgreenmoove.app.ui

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

internal fun receivedRatingCountLabel(count: Long): String {
    require(count >= 0)
    // Breakable groups preserve the full number when accessible text wraps.
    val symbols = DecimalFormatSymbols(Locale.FRANCE).apply { groupingSeparator = ' ' }
    val number = DecimalFormat("#,##0", symbols).format(count)
    return "$number avis ${if (count == 1L) "reçu" else "reçus"}"
}
