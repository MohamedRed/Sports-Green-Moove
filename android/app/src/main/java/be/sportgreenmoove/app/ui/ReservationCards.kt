package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.data.ReservationItem
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun BookingRequestsList(items: List<ReservationItem>, busy: Boolean, onDecision: (ReservationItem, ReservationDecision) -> Unit) {
    items.forEach { item ->
        val booking = item.booking
        Column(Modifier.testTag("reservation.card.${booking.bookingId}").fillMaxWidth().clip(RoundedCornerShape(SgmRadius.LG)).background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG)).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(bookingStatusLabel(booking.status), modifier = Modifier.testTag("reservation.status.${booking.bookingId}"),
                style = SgmType.Label.copy(color = Sgm.colors.textSecondary))
            Text(booking.title, style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary))
            Text("${booking.dateLabel} · ${booking.timeLabel}", style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary))
            booking.childLabel?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary)) }
            Text("${booking.seats} place${if (booking.seats > 1) "s" else ""} · ${booking.priceLabel} / place",
                style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
            booking.note?.takeIf(String::isNotBlank)?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary)) }
            if (item.refundPending) Text("Remboursement en attente", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
            item.allowedActions.forEach { decision ->
                V2Button(decisionLabel(decision), { onDecision(item, decision) }, full = true,
                    enabled = !busy, size = V2ButtonSize.Sm,
                    variant = if (decision == ReservationDecision.Approve) V2ButtonVariant.Primary else V2ButtonVariant.Secondary,
                    testTag = decisionTag(decision, booking.bookingId))
            }
        }
    }
}

internal fun bookingStatusLabel(status: String): String = when (status) {
    "requested" -> "En attente"
    "approved" -> "Approuvée"
    "declined" -> "Refusée"
    "cancelled" -> "Annulée"
    "completed" -> "Terminée"
    else -> error("Statut de réservation non reconnu.")
}

internal fun decisionLabel(decision: ReservationDecision) = when (decision) {
    ReservationDecision.Approve -> "Approuver"
    ReservationDecision.Decline -> "Refuser"
    ReservationDecision.Cancel -> "Annuler la réservation"
}

internal fun decisionTag(decision: ReservationDecision, bookingId: String) = when (decision) {
    ReservationDecision.Approve -> "${SgmTestTags.BookingApproveAction}.$bookingId"
    ReservationDecision.Decline -> "${SgmTestTags.BookingDeclineAction}.$bookingId"
    ReservationDecision.Cancel -> "${SgmTestTags.BookingCancelAction}.$bookingId"
}
