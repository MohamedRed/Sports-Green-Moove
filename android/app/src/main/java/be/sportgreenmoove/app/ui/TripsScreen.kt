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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.domain.tripFallsInMonth
import be.sportgreenmoove.app.domain.BelgianTripZone
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun TripsScreen(
    trips: List<TripSummary>,
    activeRide: LiveRideSnapshot?,
    pendingCount: Int,
    onTripAction: (TripSummary) -> Unit,
    onOpenSearch: () -> Unit,
    onOpenRide: () -> Unit,
    reservationContent: @Composable () -> Unit,
    management: TripManagementActions? = null,
    onEmergencyContact: (() -> Unit)? = null,
) {
    var selectedTab by remember { mutableStateOf("upcoming") }
    var monthIso by rememberSaveable { mutableStateOf(YearMonth.now(BelgianTripZone).toString()) }
    val month = YearMonth.parse(monthIso)
    val visibleTrips = trips.filter { trip ->
        tripFallsInMonth(trip.departureAtIso, month) && when (selectedTab) {
            "past" -> trip.status == TripStatus.Past
            "pending" -> trip.status == TripStatus.Pending
            else -> trip.status == TripStatus.Upcoming
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .sgmTestTag(SgmTestTags.TripsScreen)
            .background(Sgm.colors.bgApp)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 20.dp),
    ) {
        TripsHeader(onSearch = onOpenSearch)
        TripsMonthNav(month, { monthIso = month.minusMonths(1).toString() }, { monthIso = month.plusMonths(1).toString() })
        TripsTabs(selected = selectedTab, pendingCount = pendingCount, onSelected = { selectedTab = it })
        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (onEmergencyContact != null) {
                EmergencyContactButton("Contact d’urgence", "trips.emergency", true, onEmergencyContact)
            }
            if (activeRide != null && selectedTab != "pending") {
                ActiveRideEntryCard(activeRide, onOpenRide)
            }
            if (selectedTab == "pending") {
                reservationContent()
            } else {
                visibleTrips.forEach { trip -> TripsCard(trip = trip, onClick = { onTripAction(trip) },
                    onCancel = management?.takeIf { it.canCancel(trip) }?.let { { it.onCancel(trip) } },
                    onEdit = management?.takeIf { it.canEdit(trip) }?.onEdit?.let { { it(trip) } },
                    onReview = management?.takeIf { it.canReview(trip) }?.onReview?.let { { it(trip) } },
                    onHistory = management?.takeIf { it.role == be.sportgreenmoove.app.data.AppRole.Driver && it.uid == trip.driverUserId }
                        ?.onHistory?.let { { it(trip) } }) }
                if (visibleTrips.isEmpty()) TripsEmptyCard()
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
        CircleIconButton(icon = SgmIcon.Search, label = "Rechercher un trajet", onClick = onSearch, size = 36)
        V2ThemeButton()
    }
}

@Composable
private fun TripsMonthNav(month: YearMonth, onPrevious: () -> Unit, onNext: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, end = 20.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircleIconButton(icon = SgmIcon.ChevronLeft, label = "Mois précédent", onClick = onPrevious, size = 32, testTag = "trips.month.previous")
        Text(
            month.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.forLanguageTag("fr-BE"))).uppercase(Locale.forLanguageTag("fr-BE")),
            style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 18.sp, letterSpacing = 0.10.em),
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        CircleIconButton(icon = SgmIcon.ChevronRight, label = "Mois suivant", onClick = onNext, size = 32, testTag = "trips.month.next")
    }
}

@Composable
private fun TripsTabs(selected: String, pendingCount: Int, onSelected: (String) -> Unit) {
    Row(
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        TripsTab("upcoming", "À VENIR", selected, onSelected, Modifier.weight(1f))
        TripsTab("past", "PASSÉS", selected, onSelected, Modifier.weight(1f))
        TripsTab("pending", "RÉSERVATIONS", selected, onSelected, Modifier.weight(1.35f), badge = pendingCount.takeIf { it > 0 }?.toString())
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
                color = if (isSelected) SgmColor.TextOnAccent else Sgm.colors.textMuted,
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
private fun CircleIconButton(icon: SgmIcon, label: String, onClick: () -> Unit, size: Int, testTag: String? = null) {
    Box(
        modifier = Modifier
            .sgmOptionalTestTag(testTag)
            .size(size.dp)
            .clip(CircleShape)
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), CircleShape)
            .semantics { contentDescription = label }
            .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        SgmLineIcon(icon = icon, tint = Sgm.colors.textSecondary, modifier = Modifier.size(16.dp))
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
        Text(text, style = SgmType.BodyXS.copy(color = SgmColor.TextOnAccent, fontSize = 8.sp, fontWeight = FontWeight.Bold))
    }
}
