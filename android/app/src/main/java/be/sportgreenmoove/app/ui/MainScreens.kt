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
fun PublishScreen(role: AppRole) {
    var published by remember { mutableStateOf(false) }

    ScreenFrame {
        TopBrandBar(
            title = "Publier",
            subtitle = "Créer un trajet pour une équipe ou un club",
            trailing = { HeaderCircle("P") },
        )
        SegmentedTabs(
            options = listOf("ALLER", "RETOUR", "ALLER-RETOUR"),
            selected = "ALLER-RETOUR",
            onSelected = {},
        )

        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Détails du trajet")
            FormRow("Club", "Royal Ottignies SC")
            FormRow("Équipe", "U8 Nationaux")
            FormRow("Événement", "Match officiel")
            FormRow("Départ", "Louvain-la-Neuve · 16h45")
            FormRow("Destination", "Ottignies · Terrain 2")
        }

        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Places et sécurité")
            FormRow("Places disponibles", "2")
            FormRow("Bagage", "Sac moyen")
            FormRow("Conducteur vérifié", "Oui")
            FormRow("Suivi véhicule", "Radar actif")
            FormRow("Suivi enfant", "Si appareil disponible")
        }

        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Paiement")
            FormRow("Prix conseillé", "2,50 EUR")
            FormRow("Frais plateforme", "0 EUR")
            FormRow("Récompense CO₂", "+120 points")
        }

        if (published) {
            StatusPanel(
                title = "Trajet publié",
                body = "Les parents de l'équipe voient maintenant le trajet avec approbation conducteur obligatoire.",
                accent = SgmColors.Green,
            )
        }

        SgmButton(
            title = if (published) "Mettre à jour" else "Publier le trajet",
            onClick = { published = true },
            fullWidth = true,
        )

        Text(
            "Mode actuel: ${roleLabel(role)}",
            color = SgmColors.TextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun SearchScreen(trips: List<TripSummary>, onBack: () -> Unit) {
    ScreenFrame {
        BackHeader("Recherche", "Matching Google Routes + règles de confiance", onBack)
        SearchBox("Club, équipe, lieu ou horaire")
        Row(horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            Pill("U8", selected = true)
            Pill("Aujourd'hui", selected = true)
            Pill("2 places", selected = false)
        }

        SgmCard(background = SgmColors.GreenDark) {
            Text("MEILLEUR MATCH", color = SgmColors.GreenLight, fontSize = 11.sp, fontWeight = FontWeight.Black)
            Text("+6 min détour", color = SgmColors.Surface, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text(
                "Même équipe U8 · 2 places · conducteur vérifié · suivi enfant disponible",
                color = SgmColors.Surface.copy(alpha = 0.76f),
                fontWeight = FontWeight.SemiBold,
            )
        }

        SectionHeader("Résultats expliqués")
        trips.forEachIndexed { index, trip ->
            MatchCard(score = if (index == 0) "96" else "84", trip = trip)
        }
    }
}
