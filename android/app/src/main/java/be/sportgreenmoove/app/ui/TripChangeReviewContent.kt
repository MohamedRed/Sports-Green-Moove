package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.domain.BelgianTripZone
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun TripChangeReviewContent(review: TripChangeReview, application: TripChangeApplicationReceipt? = null) {
    val applied = review.applied || application != null
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(tripChangeStatusLabel(if (applied) TripChangeStatus.Applied else review.status), style = SgmType.BodyLG.copy(color = Sgm.colors.textPrimary),
            modifier = Modifier.testTag("trip.change.status"))
        Text("Accords reçus : ${review.acceptedParentCount} / ${review.parentCount}",
            style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary), modifier = Modifier.testTag("trip.change.consents"))
        review.decision?.let { Text(if (it == TripChangeDecision.Accept) "Votre accord est enregistré." else "Votre refus est enregistré.",
            style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary), modifier = Modifier.testTag("trip.change.decision")) }
        TripChangeTermsContent("Détails initiaux", "original", review.originalTerms)
        TripChangeTermsContent("Détails proposés", "proposed", review.terms)
        if (review.status == TripChangeStatus.Outdated) TripChangeTermsContent("Détails actuels", "current", review.currentTerms)
        if (!applied && review.status in setOf(TripChangeStatus.Pending, TripChangeStatus.Confirmed))
            Text("Les détails proposés ne sont pas encore appliqués.", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        if (review.canRespond) Text("Votre décision concerne ${review.bookingIds.size} réservation${if (review.bookingIds.size > 1) "s" else ""}.",
            style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        val balances = if (application != null && !review.applied) emptyList() else review.balances
        balances.filter { it.balanceCents != 0 }.forEach { balance ->
            Text(if (balance.balanceCents > 0) "Supplément restant : ${tripChangeMoney(balance.balanceCents)}"
                else "Remboursement restant : ${tripChangeMoney(-balance.balanceCents)}",
                style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary), modifier = Modifier.testTag("trip.change.balance.${balance.bookingId}"))
        }
        if (application != null && !review.applied) Text("Actualisez pour voir les soldes après modification.",
            style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        if (balances.any { it.balanceCents != 0 }) Text("Aucun règlement ni remboursement n’est confirmé ici.",
            style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
    }
}

@Composable
internal fun TripChangeTermsContent(label: String, tag: String, terms: TripChangeTerms) {
    Column(Modifier.fillMaxWidth().testTag("trip.change.$tag"), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = SgmType.BodyLG.copy(color = Sgm.colors.textPrimary))
        Text("Départ : ${tripChangeDate(terms.departureAt)}", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        terms.arrivalBy?.let { Text("Arrivée souhaitée : ${tripChangeDate(it)}", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary)) }
        Text("${tripChangeMoney(terms.priceCents)} / place", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        Text("Départ : ${tripChangeCoordinates(terms.origin)}", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        Text("Destination : ${tripChangeCoordinates(terms.destination)}", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        if (stringResource(R.string.sgm_google_maps_android_api_key).isNotBlank())
            NativeGoogleMap(MapRoutePreview(terms.origin, terms.destination), showRoute = false)
        else Text("Carte indisponible.", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
    }
}

internal fun tripChangeStatusLabel(status: TripChangeStatus) = when (status) {
    TripChangeStatus.Pending -> "Accords des parents en attente"
    TripChangeStatus.Confirmed -> "Tous les parents ont confirmé"
    TripChangeStatus.Declined -> "Modification refusée, trajet initial conservé"
    TripChangeStatus.Withdrawn -> "Proposition retirée, trajet initial conservé"
    TripChangeStatus.Cancelled -> "Trajet annulé"
    TripChangeStatus.Applied -> "Nouveaux détails appliqués"
    TripChangeStatus.Outdated -> "Les détails ou les réservations ont changé"
}
internal fun tripChangeMoney(cents: Int) = String.format(Locale.forLanguageTag("fr-BE"), "%.2f EUR", cents / 100.0)
private fun tripChangeCoordinates(point: MapPoint) = String.format(Locale.ROOT, "%.6f, %.6f", point.lat, point.lng)
internal fun tripChangeDate(value: String) = Instant.parse(value).atZone(BelgianTripZone)
    .format(DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm XXX", Locale.forLanguageTag("fr-BE")))
