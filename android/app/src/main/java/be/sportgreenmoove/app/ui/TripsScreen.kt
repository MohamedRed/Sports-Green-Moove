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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

private val TripsList = listOf(
    TripsTripUi("Football", "U8 NATIONAUX VS ROYAL OTTIGNIES SC", "MAR 07 NOV", "16h45", "5.2 km", "2 places", listOf("IB", "NT"), "upcoming"),
    TripsTripUi("Football", "ENTRAÎNEMENT U8 — GROUPE B", "JEU 10 NOV", "18h00", "4.8 km", "2 places", listOf("NC"), "upcoming"),
    TripsTripUi("Football", "U8 VS FOOTBALL CLUB DE BRUGES", "SAM 14 NOV", "10h00", "8.1 km", "3 places", listOf("IB", "NT", "JC"), "upcoming"),
    TripsTripUi("Football", "ENTRAÎNEMENT U8 — GROUPE A", "LUN 24 OCT", "17h30", "4.8 km", "2 places", listOf("IB"), "past"),
    TripsTripUi("Tennis", "MATCH SIMPLE — CATÉGORIE B", "SAM 22 OCT", "09h00", "3.2 km", "1 place", listOf("NT"), "past"),
)

@Composable
fun TripsScreen(
    trips: List<TripSummary>,
    activeRide: LiveRideSnapshot?,
    onStartRide: () -> Unit,
    onOpenSearch: () -> Unit,
) {
    var selectedTab by remember { mutableStateOf("upcoming") }
    val visibleTrips = TripsList.filter { it.status == if (selectedTab == "pending") "upcoming" else selectedTab }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Sgm.colors.bgApp)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 20.dp),
    ) {
        TripsHeader(onSearch = onOpenSearch)
        TripsMonthNav()
        TripsTabs(selected = selectedTab, onSelected = { selectedTab = it })
        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            visibleTrips.forEach { trip -> TripsCard(trip = trip, onClick = onStartRide) }
            if (selectedTab == "pending") {
                PendingRequestsCard()
            }
        }
    }
}

@Composable
private fun TripsHeader(onSearch: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 34.dp, end = 20.dp, bottom = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "MES TRAJETS",
            style = SgmType.DisplayXL.copy(color = Sgm.colors.textPrimary, fontSize = 22.sp, letterSpacing = 0.08.em),
            modifier = Modifier.weight(1f),
        )
        CircleIconButton(icon = SgmIcon.Search, onClick = onSearch, size = 36)
        CircleIconButton(icon = SgmIcon.Moon, onClick = {}, size = 36)
    }
}

@Composable
private fun TripsMonthNav() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, end = 20.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircleIconButton(icon = SgmIcon.ChevronLeft, onClick = {}, size = 32)
        Text(
            "NOVEMBRE 2022",
            style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 18.sp, letterSpacing = 0.10.em),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        CircleIconButton(icon = SgmIcon.ChevronRight, onClick = {}, size = 32)
    }
}

@Composable
private fun TripsTabs(selected: String, onSelected: (String) -> Unit) {
    Row(
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        TripsTab("upcoming", "À VENIR", selected, onSelected, Modifier.weight(1f))
        TripsTab("past", "PASSÉS", selected, onSelected, Modifier.weight(1f))
        TripsTab("pending", "EN ATTENTE", selected, onSelected, Modifier.weight(1f), badge = "2")
    }
}

@Composable
private fun TripsTab(id: String, label: String, selected: String, onSelected: (String) -> Unit, modifier: Modifier, badge: String? = null) {
    val isSelected = selected == id
    Row(
        modifier = modifier
            .height(34.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (isSelected) SgmColor.Green else Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(999.dp))
            .clickable { onSelected(id) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Text(
            label,
            style = SgmType.Label.copy(
                color = if (isSelected) SgmColor.TextOnGreen else Sgm.colors.textMuted,
                fontSize = 10.sp,
                letterSpacing = 0.06.em,
            ),
            maxLines = 1,
        )
        if (badge != null) {
            Spacer(Modifier.size(4.dp))
            TabBadge(badge)
        }
    }
}

@Composable
private fun TripsCard(trip: TripsTripUi, onClick: () -> Unit) {
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
            Text(trip.sport.uppercase(), style = SgmType.Eyebrow.copy(color = SgmColor.GreenLight, fontSize = 11.sp, letterSpacing = 0.14.em))
            Spacer(Modifier.weight(1f))
            Text("${trip.date} · ${trip.time}", style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.62f), fontWeight = FontWeight.Bold))
        }
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                trip.title,
                style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 18.sp, lineHeight = 20.sp, letterSpacing = 0.03.em),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                TripMeta(SgmIcon.Location, trip.distance)
                Spacer(Modifier.size(14.dp))
                TripMeta(SgmIcon.Groups, trip.seats)
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
                    trip.passengers.forEach { initials -> PassengerBubble(initials) }
                }
            }
        }
    }
}

@Composable
private fun TripMeta(icon: SgmIcon, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        SgmLineIcon(icon = icon, tint = Sgm.colors.textMuted, modifier = Modifier.size(12.dp))
        Text(text, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium))
    }
}

@Composable
private fun CircleIconButton(icon: SgmIcon, onClick: () -> Unit, size: Int) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        SgmLineIcon(icon = icon, tint = Sgm.colors.textSecondary, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun PassengerBubble(initials: String) {
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(SgmColor.Green)
            .border(BorderStroke(2.dp, Sgm.colors.bgCard), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials.take(2).uppercase(), style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen, fontSize = 8.sp, fontWeight = FontWeight.Bold))
    }
}

@Composable
private fun TabBadge(text: String) {
    Box(
        modifier = Modifier
            .size(14.dp)
            .clip(CircleShape)
            .background(SgmColor.Orange),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen, fontSize = 8.sp, fontWeight = FontWeight.Bold))
    }
}

@Composable
private fun PendingRequestsCard() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "DEMANDES EN ATTENTE",
            style = SgmType.Eyebrow.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, letterSpacing = 0.12.em),
        )
        Text("Idriss BAMAKO · U8 vs Ottignies", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold))
        Text("Kévin TOUSSAINT · U8 vs Ottignies", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold))
    }
}

private data class TripsTripUi(
    val sport: String,
    val title: String,
    val date: String,
    val time: String,
    val distance: String,
    val seats: String,
    val passengers: List<String>,
    val status: String,
)
