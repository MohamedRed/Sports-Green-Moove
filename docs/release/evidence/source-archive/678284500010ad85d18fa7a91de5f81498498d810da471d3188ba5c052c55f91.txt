package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.*

@Composable
internal fun TripsCard(trip: TripSummary, onClick: () -> Unit, onCancel: (() -> Unit)?, onEdit: (() -> Unit)? = null,
    onReview: (() -> Unit)? = null, onHistory: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.LG)).background(Sgm.colors.bgCard)
        .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))) {
        val action = if (trip.status != TripStatus.Past && !trip.cancelled) Modifier.clickable(onClick = onClick) else Modifier
        Column(Modifier.fillMaxWidth().then(action)) {
            Row(Modifier.fillMaxWidth().background(SgmColor.HeroStart).padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(trip.sport.uppercase(), style = SgmType.Eyebrow.copy(color = SgmColor.GreenLight, fontSize = 11.sp, letterSpacing = 0.14.em),
                    modifier = Modifier.weight(1f))
                Text("${trip.dateLabel} · ${trip.timeLabel}", style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.62f), fontWeight = FontWeight.Bold))
            }
            Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(trip.title, style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 18.sp, lineHeight = 20.sp, letterSpacing = 0.03.em),
                    maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (trip.cancelled) Text("Annulé", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary),
                    modifier = Modifier.testTag("trip.cancelled.${trip.id}"))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        TripMeta(SgmIcon.Location, trip.distanceLabel)
                        TripMeta(SgmIcon.Groups, trip.seatsLabel)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
                        trip.passengerInitials.take(8).forEach { PassengerBubble(it) }
                    }
                }
            }
        }
        if (onEdit != null) TextButton(onClick = onEdit, modifier = Modifier.padding(horizontal = 6.dp).testTag("trip.edit.${trip.id}")) {
            Text("Modifier les détails", color = Sgm.colors.textPrimary)
        }
        if (onReview != null) TextButton(onClick = onReview, modifier = Modifier.padding(horizontal = 6.dp).testTag("trip.review.${trip.id}")) {
            Text("Voir la modification", color = Sgm.colors.textPrimary)
        }
        if (onCancel != null) TextButton(onClick = onCancel, modifier = Modifier.padding(horizontal = 6.dp).testTag("trip.cancel.${trip.id}")) {
            Text("Annuler le trajet", color = Sgm.colors.textPrimary)
        }
        if (onHistory != null) TextButton(onClick = onHistory, modifier = Modifier.padding(horizontal = 6.dp).testTag("trip.history.${trip.id}")) {
            Text("Historique des modifications", color = Sgm.colors.textPrimary)
        }
    }
}

@Composable
internal fun TripsEmptyCard() {
    Text("Aucun trajet dans cet onglet.", style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.LG)).background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG)).padding(16.dp))
}

@Composable
private fun TripMeta(icon: SgmIcon, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        SgmLineIcon(icon = icon, tint = Sgm.colors.textMuted, modifier = Modifier.size(12.dp))
        Text(text, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium))
    }
}

@Composable
private fun PassengerBubble(initials: String) {
    Box(Modifier.size(24.dp).clip(CircleShape).background(SgmColor.Green).border(BorderStroke(2.dp, Sgm.colors.bgCard), CircleShape),
        contentAlignment = Alignment.Center) {
        Text(initials.take(2).uppercase(), style = SgmType.BodyXS.copy(color = SgmColor.TextOnAccent, fontSize = 8.sp, fontWeight = FontWeight.Bold))
    }
}
