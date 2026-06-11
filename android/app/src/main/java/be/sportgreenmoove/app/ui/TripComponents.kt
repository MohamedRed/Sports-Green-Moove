package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.SgmColors
import be.sportgreenmoove.app.design.SgmSpacing

@Composable
fun TripCard(trip: TripSummary, highlight: Boolean, onClick: () -> Unit) {
    val background = if (highlight) SgmColors.Card else SgmColors.Surface
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(background)
            .border(BorderStroke(1.dp, if (highlight) SgmColors.Green.copy(alpha = 0.32f) else SgmColors.Border), RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(SgmSpacing.X4),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Pill(trip.category.uppercase(), selected = true)
            Spacer(Modifier.weight(1f))
            Text(trip.departureLabel, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Black)
        }
        Text(trip.title, color = SgmColors.TextPrimary, fontSize = 19.sp, lineHeight = 21.sp, fontWeight = FontWeight.Black)
        Text(trip.club, color = SgmColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            SmallBadge("${trip.seatsAvailable} places", SgmColors.Green)
            SmallBadge(trip.priceLabel, SgmColors.Orange)
        }
        trip.reasons.take(3).forEach { reason ->
            Text(reason, color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun MatchCard(score: String, trip: TripSummary) {
    SgmCard(background = SgmColors.Surface) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3)) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(CircleShape)
                    .background(SgmColors.Green.copy(alpha = 0.16f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(score, color = SgmColors.GreenDark, fontSize = 20.sp, fontWeight = FontWeight.Black)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
                Text(trip.title, color = SgmColors.TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(trip.reasons.joinToString(" · "), color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun LiveRideCard(ride: LiveRideSnapshot, onClick: () -> Unit) {
    SgmCard(
        background = if (ride.stale) SgmColors.Orange.copy(alpha = 0.16f) else SgmColors.Card,
        modifier = Modifier.clickable(onClick = onClick),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
                Text("SUIVI EN DIRECT", color = SgmColors.Green, fontSize = 11.sp, fontWeight = FontWeight.Black)
                Text(ride.etaLabel, color = SgmColors.TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Text("Statut: ${ride.status}", color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            HeaderCircle("ON")
        }
        FormRow("Véhicule", ride.vehicleLastUpdateLabel)
        FormRow("Enfant", ride.childLastUpdateLabel ?: "Non disponible")
        if (ride.stale) {
            Text("Position à vérifier", color = SgmColors.Orange, fontSize = 13.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun MapPanel() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(250.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(SgmColors.GreenDark),
    ) {
        GridAccent(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(SgmSpacing.X5),
        )
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(SgmSpacing.X5),
            verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2),
        ) {
            Text("TRAJET ACTIF", color = SgmColors.GreenLight, fontSize = 11.sp, fontWeight = FontWeight.Black)
            Text("Louvain-la-Neuve → Ottignies", color = SgmColors.Surface, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Véhicule et enfant mis à jour en temps réel", color = SgmColors.Surface.copy(alpha = 0.76f), fontWeight = FontWeight.SemiBold)
        }
        RouteDot(Modifier.align(Alignment.CenterStart).padding(start = 56.dp), "D")
        RouteDot(Modifier.align(Alignment.CenterEnd).padding(end = 56.dp), "A")
    }
}

@Composable
fun RouteDot(modifier: Modifier, text: String) {
    Box(
        modifier = modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(SgmColors.Surface),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = SgmColors.GreenDark, fontWeight = FontWeight.Black)
    }
}

@Composable
fun MetricCard(value: String, label: String, accent: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .heightIn(min = 102.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(16.dp))
            .padding(SgmSpacing.X3),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, color = accent, fontSize = 25.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, maxLines = 1)
        Text(label, color = SgmColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
    }
}

@Composable
fun ImpactStrip(onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(SgmColors.Green.copy(alpha = 0.12f))
            .clickable(onClick = onClick)
            .padding(SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        HeaderCircle("CO")
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text("Impact de la semaine", color = SgmColors.TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
            Text("3,1 kg CO₂ économisés sur 4 trajets", color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(">", color = SgmColors.Green, fontSize = 20.sp, fontWeight = FontWeight.Black)
    }
}

