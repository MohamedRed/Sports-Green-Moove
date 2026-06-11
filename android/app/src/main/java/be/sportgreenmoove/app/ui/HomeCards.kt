package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun rememberHomeTrips(trips: List<TripSummary>): List<HomeTripUi> =
    trips.take(2).map { trip ->
        HomeTripUi(
            sport = trip.sport,
            title = trip.title,
            date = trip.dateLabel,
            time = trip.timeLabel,
            distance = trip.distanceLabel,
            seats = trip.seatsLabel,
            passengers = trip.passengerInitials,
        )
    }

@Composable
fun HomeStatsRow() {
    Row(
        modifier = Modifier.padding(start = 20.dp, top = 16.dp, end = 20.dp, bottom = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HomeMetricCard("12,4", "kg", "CO₂ économisé", SgmColor.Green, Modifier.weight(1f))
        HomeMetricCard("24", "trajets", "Partagés", SgmColor.Orange, Modifier.weight(1f))
        HomeMetricCard("847", "km", "Parcourus", SgmColor.Green, Modifier.weight(1f))
    }
}

@Composable
fun HomeSectionLabel(title: String, action: String?, onAction: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 4.dp, end = 20.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 19.sp, lineHeight = 20.sp, letterSpacing = 0.08.em),
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        if (action != null && onAction != null) {
            Text(
                action,
                style = SgmType.BodyXS.copy(color = SgmColor.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold),
                modifier = Modifier.clickable(onClick = onAction),
                maxLines = 1,
            )
        }
    }
}

@Composable
fun HomeTripCard(trip: HomeTripUi, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(SgmColor.HeroStart)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(trip.sport, style = SgmType.Eyebrow.copy(color = SgmColor.GreenLight, fontSize = 11.sp, lineHeight = 11.sp, letterSpacing = 0.14.em))
            Spacer(Modifier.weight(1f))
            Text(
                "${trip.date} · ${trip.time}",
                style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.62f), fontSize = 11.sp, lineHeight = 12.sp, fontWeight = FontWeight.Bold),
                textAlign = TextAlign.End,
            )
        }
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                trip.title,
                style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 18.sp, lineHeight = 20.sp, letterSpacing = 0.03.em),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                HomeMeta(SgmIcon.Location, trip.distance)
                Spacer(Modifier.size(14.dp))
                HomeMeta(SgmIcon.Groups, trip.seats)
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
                    trip.passengers.forEach { initials -> PassengerBadge(initials) }
                }
            }
        }
    }
}

@Composable
fun HomeImpactCard(onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(SgmColor.HeroGradient)
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(SgmColor.Green.copy(alpha = 0.16f)),
            contentAlignment = Alignment.Center,
        ) {
            Text("CO₂", style = SgmType.DisplayLG.copy(color = SgmColor.Green, fontSize = 14.sp))
        }
        Column {
            Text("CO₂ EN TEMPS RÉEL", style = SgmType.DisplayXL.copy(color = SgmColor.TextOnGreen, fontSize = 22.sp, letterSpacing = 0.04.em))
            Text(
                "Wallonie · Flandre · Bruxelles\n37.356 + 45.784 + 29.886 utilisateurs",
                style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.65f), fontSize = 12.sp, lineHeight = 18.sp),
            )
        }
    }
}

@Composable
fun HomeEmptyTrips() {
    Text(
        "Aucun trajet publié pour le moment.",
        style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(16.dp),
    )
}

@Composable
private fun HomeMetricCard(value: String, unit: String, label: String, accent: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .height(82.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(14.dp))
            .padding(horizontal = 8.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(value, style = SgmType.DisplayXL.copy(color = accent, fontSize = 28.sp, lineHeight = 28.sp), maxLines = 1)
        Text(unit, style = SgmType.BodyXS.copy(color = accent, fontSize = 10.sp, lineHeight = 10.sp, fontWeight = FontWeight.Bold), maxLines = 1)
        Text(
            label,
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 10.sp, lineHeight = 12.sp, fontWeight = FontWeight.Medium),
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}

@Composable
private fun HomeMeta(icon: SgmIcon, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        SgmLineIcon(icon = icon, tint = Sgm.colors.textMuted, modifier = Modifier.size(12.dp))
        Text(text, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium))
    }
}

@Composable
private fun PassengerBadge(initials: String) {
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(SgmColor.Green)
            .border(BorderStroke(2.dp, Sgm.colors.bgCard), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials, style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen, fontSize = 8.sp, fontWeight = FontWeight.Bold))
    }
}

data class HomeTripUi(
    val sport: String,
    val title: String,
    val date: String,
    val time: String,
    val distance: String,
    val seats: String,
    val passengers: List<String>,
)
