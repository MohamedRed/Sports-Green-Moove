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
