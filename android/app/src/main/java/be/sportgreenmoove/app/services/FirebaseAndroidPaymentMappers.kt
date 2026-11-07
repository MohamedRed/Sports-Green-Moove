package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.domain.tripDateLabel
import be.sportgreenmoove.app.domain.tripTimeLabel
import com.google.firebase.Timestamp
import java.time.Instant
import java.util.Date
import java.util.Locale

internal fun mapPayableBooking(
    id: String,
    booking: Map<String, Any>,
    trip: Map<String, Any>,
): PayableBookingSummary? {
    val seats = (booking["seats"] as? Number)?.toInt() ?: 1
    val priceCents = (trip["priceCents"] as? Number)?.toInt() ?: return null
    val amountCents = seats * priceCents
    if (amountCents <= 0) return null
    val departure = paymentDateValue(trip["departureAt"])

    return PayableBookingSummary(
        bookingId = id,
        tripId = booking["tripId"] as? String ?: return null,
        title = trip["title"] as? String ?: "${trip["category"] as? String ?: "Trajet"} sportif",
        club = trip["clubName"] as? String ?: trip["clubId"] as? String ?: "Club",
        dateLabel = departure?.toInstant()?.let(::tripDateLabel) ?: "DATE À CONFIRMER",
        timeLabel = departure?.toInstant()?.let(::tripTimeLabel) ?: "--h--",
        seats = seats,
        amountCents = amountCents,
        amountLabel = paymentPriceLabel(amountCents),
        paymentStatus = booking["paymentStatus"] as? String ?: "required",
    )
}

private fun paymentDateValue(value: Any?): Date? =
    when (value) {
        is Timestamp -> value.toDate()
        is Date -> value
        is String -> runCatching { Date.from(Instant.parse(value)) }.getOrNull()
        else -> null
    }

private fun paymentPriceLabel(cents: Int): String =
    "%.2f EUR".format(PaymentBelgianFrenchLocale, cents.toDouble() / 100.0)

private val PaymentBelgianFrenchLocale: Locale = Locale.Builder()
    .setLanguage("fr")
    .setRegion("BE")
    .build()
