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
fun OptionsScreen(onBack: () -> Unit) {
    ScreenFrame {
        BackHeader("Options", "Sécurité, permissions et support", onBack)
        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Sécurité")
            FormRow("Contact urgence", "+32 470 00 00 00")
            FormRow("Journal d'audit", "Activé")
            FormRow("Consentement parent", "Obligatoire")
        }
        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Permissions")
            FormRow("Localisation arrière-plan", "Trajets actifs")
            FormRow("Notifications", "Activées")
            FormRow("Partage enfant", "Au choix parent")
        }
        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Paiements")
            FormRow("Carte", "Stripe PaymentSheet")
            FormRow("Payout", "Stripe Connect")
        }
    }
}

@Composable
fun RideMonitorScreen(activeRide: LiveRideSnapshot?, onBack: () -> Unit) {
    val ride = activeRide ?: LiveRideSnapshot(
        rideSessionId = "ride-demo",
        status = "Démo",
        vehicleLastUpdateLabel = "Il y a 12 s",
        childLastUpdateLabel = "Il y a 35 s",
        etaLabel = "Arrivée estimée 16h38",
        stale = false,
    )

    ScreenFrame {
        BackHeader("Course active", "Suivi véhicule, enfant, pickup et ETA", onBack)
        MapPanel()
        LiveRideCard(ride = ride, onClick = {})

        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Statuts")
            ChildRow("Véhicule", ride.vehicleLastUpdateLabel, "Radar trip tracking")
            ChildRow("Kévin", ride.childLastUpdateLabel ?: "Non disponible", "Appareil enfant")
            ChildRow("Pickup", "Validé à 16h47", "Confirmation conducteur")
            ChildRow("Dropoff", "En route", ride.etaLabel)
        }

        StatusPanel(
            title = "Contact urgence",
            body = "Action directe disponible pendant toute course active.",
            accent = SgmColors.Orange,
        )
    }
}
