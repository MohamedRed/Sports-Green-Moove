package be.sportgreenmoove.app.domain

import java.math.BigDecimal

const val TripPriceValidationMessage = "Le prix doit être compris entre 0 et 1 000 EUR, avec deux décimales maximum."

fun tripPriceCents(value: String): Int? {
    val text = value.trim()
    if (!Regex("^(0|[1-9][0-9]{0,3})([,.][0-9]{1,2})?$").matches(text)) return null
    return runCatching { BigDecimal(text.replace(',', '.')).movePointRight(2).intValueExact() }
        .getOrNull()?.takeIf { it in 0..100_000 }
}

fun publicationPriceCents(value: String): Int? = if (value.isBlank()) 0 else tripPriceCents(value)

fun publicationPriceLabel(value: String): String {
    val cents = publicationPriceCents(value) ?: return "Prix invalide"
    if (cents == 0) return "Gratuit"
    return "${cents / 100},${(cents % 100).toString().padStart(2, '0')} EUR"
}
