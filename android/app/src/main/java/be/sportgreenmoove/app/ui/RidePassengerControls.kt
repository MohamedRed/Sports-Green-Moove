package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun RidePassengerStatusCard(
    ride: LiveRideSnapshot,
    onPickup: (RidePassengerStatus) -> Unit,
    onDropoff: (RidePassengerStatus) -> Unit,
) {
    Column(
        modifier = Modifier
            .padding(start = 20.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RideTrackingLine("Véhicule", ride.vehicleLastUpdateLabel)
        RideTrackingLine("Enfant", ride.childLastUpdateLabel ?: "Non disponible")
        if (ride.passengers.isEmpty()) {
            Text(
                "Aucun passager approuvé attaché à cette course.",
                style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
            )
        } else {
            ride.passengers.forEach { passenger ->
                PassengerActionRow(
                    passenger = passenger,
                    onPickup = { onPickup(passenger) },
                    onDropoff = { onDropoff(passenger) },
                )
            }
        }
    }
}

@Composable
fun RideEndCard(onEndRide: () -> Unit) {
    Column(
        modifier = Modifier
            .padding(start = 20.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "FIN DE COURSE",
            style = SgmType.Eyebrow.copy(color = SgmColor.Orange, fontSize = 11.sp, letterSpacing = 0.12.em),
        )
        Text(
            "Arrête le suivi Radar et le secours GPS Firebase, puis clôture les réservations attachées.",
            style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
        )
        V2Button("TERMINER LA COURSE", onClick = onEndRide, variant = V2ButtonVariant.Orange, full = true, testTag = SgmTestTags.ActiveRideEndAction)
    }
}

@Composable
private fun PassengerActionRow(
    passenger: RidePassengerStatus,
    onPickup: () -> Unit,
    onDropoff: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            V2Avatar(passenger.label, size = 34)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    passenger.label,
                    style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold),
                )
                Text(
                    "Pickup ${passenger.pickupStatus.statusLabel()} · Dropoff ${passenger.dropoffStatus.statusLabel()}",
                    style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            V2Button(
                "PICKUP",
                onClick = onPickup,
                modifier = Modifier.weight(1f),
                variant = if (passenger.pickupStatus == "pickedUp") V2ButtonVariant.Secondary else V2ButtonVariant.Primary,
                size = V2ButtonSize.Sm,
                testTag = SgmTestTags.ActiveRidePickupAction,
            )
            V2Button(
                "DROPOFF",
                onClick = onDropoff,
                modifier = Modifier.weight(1f),
                variant = if (passenger.dropoffStatus == "droppedOff") V2ButtonVariant.Secondary else V2ButtonVariant.Primary,
                size = V2ButtonSize.Sm,
                testTag = SgmTestTags.ActiveRideDropoffAction,
            )
        }
    }
}

@Composable
private fun RideTrackingLine(label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            label,
            style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
            modifier = Modifier.weight(1f),
        )
        Text(
            value,
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium),
        )
    }
}

private fun String.statusLabel(): String =
    when (this) {
        "pickedUp" -> "validé"
        "droppedOff" -> "validé"
        else -> "à confirmer"
    }
