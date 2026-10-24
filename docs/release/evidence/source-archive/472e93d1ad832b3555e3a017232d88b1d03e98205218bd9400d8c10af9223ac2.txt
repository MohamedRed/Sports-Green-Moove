package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.MapRoutePreview
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmType

@Composable
fun RideMonitorScreen(
    activeRide: LiveRideSnapshot?,
    canManageRide: Boolean,
    routePreview: MapRoutePreview?,
    onBack: () -> Unit,
    onPickup: (RidePassengerStatus) -> Unit,
    onDropoff: (RidePassengerStatus) -> Unit,
    onEndRide: () -> Unit,
    onEmergencyContact: () -> Unit,
    observation: ActiveRideObservationState? = null,
) {
    V2Screen(testTag = SgmTestTags.ActiveRideScreen) {
        V2TopBar("COURSE ACTIVE", onBack = onBack)
        if (activeRide == null) {
            RideEmptyState(onBack)
        } else if (observation != null && observation.phase != RideObservationPhase.Live) {
            RideObservationNotice(observation)
        } else {
            GoogleMapsRoutePreviewCard(ride = activeRide, preview = routePreview)
            RideLiveCard(activeRide)
            V2SectionLabel("STATUTS")
            RidePassengerStatusCard(
                ride = activeRide,
                canManageRide = canManageRide,
                onPickup = onPickup,
                onDropoff = onDropoff,
            )
            if (canManageRide) RideEndCard(
                readyToComplete = activeRide.passengers.all { it.pickupStatus == "pickedUp" && it.dropoffStatus == "droppedOff" },
                onEndRide = onEndRide,
            )
            RideEmergencyAction(onEmergencyContact)
        }
    }
}

@Composable
private fun RideEmptyState(onBack: () -> Unit) {
    Column(
        modifier = Modifier.padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(250.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(SgmColor.HeroGradient),
            contentAlignment = Alignment.Center,
        ) {
            SgmGridTexture()
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("AUCUNE COURSE ACTIVE", style = SgmType.DisplayXL.copy(color = SgmColor.TextOnGreen, fontSize = 24.sp, letterSpacing = 0.06.em), textAlign = TextAlign.Center)
                Text(
                    "Démarrez le suivi depuis un trajet confirmé pour partager véhicule, enfant, ETA et statuts.",
                    style = SgmType.BodySM.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.66f), fontSize = 13.sp),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )
            }
        }
        V2Button("RETOUR AUX TRAJETS", onClick = onBack, full = true, size = V2ButtonSize.Lg)
    }
}

@Composable
private fun RideLiveCard(ride: LiveRideSnapshot) {
    Column(
        modifier = Modifier
            .padding(start = 20.dp, top = 16.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(if (ride.stale) SgmColor.Orange.copy(alpha = 0.12f) else Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, if (ride.stale) SgmColor.Orange.copy(alpha = 0.32f) else Sgm.colors.border), RoundedCornerShape(20.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("SESSION ${ride.rideSessionId.takeLast(6).uppercase()}", style = SgmType.Eyebrow.copy(color = SgmColor.Green, fontSize = 11.sp, letterSpacing = 0.14.em))
                Text(ride.status.uppercase(), style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 20.sp, letterSpacing = 0.04.em))
            }
            RideStatusPill(if (ride.stale) "À VÉRIFIER" else "LIVE", warning = ride.stale)
        }
        RideInfoLine(SgmIcon.Location, "Véhicule", ride.vehicleLastUpdateLabel, SgmTestTags.ActiveRideVehicleUpdate)
        RideInfoLine(SgmIcon.Profile, "Enfant", ride.childLastUpdateLabel ?: "Non disponible")
        if (ride.stale) {
            Text(
                "Position à vérifier avant confirmation.",
                style = SgmType.BodyXS.copy(color = SgmColor.Orange, fontSize = 12.sp, fontWeight = FontWeight.Bold),
                modifier = Modifier.sgmTestTag(SgmTestTags.ActiveRideStaleWarning),
            )
        }
    }
}

@Composable
private fun RideEmergencyAction(onOpen: () -> Unit) {
    Box(Modifier.padding(horizontal = 20.dp)) {
        EmergencyContactButton("Contact d’urgence", SgmTestTags.EmergencyContact, true, onOpen, SgmIcon.Profile)
    }
}

@Composable
private fun RideInfoLine(icon: SgmIcon, label: String, value: String, tag: String? = null) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SgmLineIcon(icon, tint = Sgm.colors.textMuted, modifier = Modifier.size(14.dp))
        Text(label, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f))
        Text(value, style = SgmType.BodyXS.copy(color = Sgm.colors.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold),
            textAlign = TextAlign.End, modifier = Modifier.weight(2f).sgmOptionalTestTag(tag))
    }
}

@Composable
private fun RideStatusPill(text: String, warning: Boolean) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (warning) SgmColor.Orange.copy(alpha = 0.16f) else SgmColor.Green.copy(alpha = 0.16f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text, style = SgmType.Label.copy(color = if (warning) SgmColor.Orange else SgmColor.Green, fontSize = 10.sp, letterSpacing = 0.06.em))
    }
}
