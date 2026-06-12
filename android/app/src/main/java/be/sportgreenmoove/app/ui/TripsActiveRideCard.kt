package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType

@Composable
fun ActiveRideEntryCard(ride: LiveRideSnapshot, onOpen: () -> Unit) {
    val backgroundModifier = if (ride.stale) {
        Modifier.background(SgmColor.Orange.copy(alpha = 0.12f))
    } else {
        Modifier.background(SgmColor.HeroGradient)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .then(backgroundModifier)
            .border(BorderStroke(1.dp, if (ride.stale) SgmColor.Orange.copy(alpha = 0.32f) else Sgm.colors.border), RoundedCornerShape(20.dp))
            .clickable(onClick = onOpen)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "SUIVI EN DIRECT",
            style = SgmType.Eyebrow.copy(
                color = if (ride.stale) SgmColor.Orange else SgmColor.GreenLight,
                fontSize = 11.sp,
                letterSpacing = 0.14.em,
            ),
        )
        Text(
            ride.etaLabel,
            style = SgmType.DisplayLG.copy(
                color = if (ride.stale) Sgm.colors.textPrimary else SgmColor.TextOnGreen,
                fontSize = 22.sp,
                letterSpacing = 0.04.em,
            ),
        )
        Text(
            "Véhicule · ${ride.vehicleLastUpdateLabel}",
            style = SgmType.BodyXS.copy(
                color = if (ride.stale) SgmColor.Orange else SgmColor.TextOnGreen.copy(alpha = 0.72f),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
    }
}
