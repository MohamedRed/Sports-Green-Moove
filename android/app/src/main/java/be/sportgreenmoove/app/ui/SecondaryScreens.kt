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
fun MessagesScreen() {
    var selectedTab by remember { mutableStateOf("NOTIFS") }
    val items = when (selectedTab) {
        "CHATS" -> listOf(
            MessagePreview("Nadège Toussaint", "Parfait, je récupère Léo à 16h35.", "16:08", "NT"),
            MessagePreview("Groupe U8 Nationaux", "Le match est confirmé sur le terrain 2.", "15:42", "U8"),
            MessagePreview("Thomas Driver", "J'ai encore une place disponible.", "Hier", "TD"),
        )

        "AVIS" -> listOf(
            MessagePreview("Note reçue", "5,0 · conduite ponctuelle et rassurante.", "Lun", "5"),
            MessagePreview("Avis demandé", "Évalue le trajet Royal Ottignies.", "Dim", "A"),
        )

        else -> listOf(
            MessagePreview("Départ confirmé", "Le conducteur a démarré le suivi Radar.", "Maintenant", "S"),
            MessagePreview("Kévin récupéré", "Statut pickup validé à 16h47.", "16:47", "K"),
            MessagePreview("Paiement accepté", "2,50 EUR autorisés via Stripe.", "16:12", "€"),
        )
    }

    ScreenFrame {
        TopBrandBar(
            title = "Messages",
            subtitle = "Notifications, chats et avis",
            trailing = { HeaderCircle("3") },
        )
        SegmentedTabs(
            options = listOf("NOTIFS", "CHATS", "AVIS"),
            selected = selectedTab,
            onSelected = { selectedTab = it },
        )

        items.forEach { preview -> MessageCard(preview) }
    }
}

@Composable
fun GroupsScreen(onBack: () -> Unit) {
    ScreenFrame {
        BackHeader("Groupes", "Clubs, équipes, membres et permissions", onBack)
        GroupCard("Royal Ottignies SC", "U8 Nationaux", "38 membres", "Club vérifié", selected = true)
        GroupCard("Collège du Biéreau", "U8 Groupe B", "24 membres", "École partenaire", selected = false)
        GroupCard("Louvain Tennis Club", "Compétition junior", "16 membres", "Invitations ouvertes", selected = false)

        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Consentements")
            FormRow("Kévin", "Parent validé")
            FormRow("Léo", "Parent validé")
            FormRow("Invitations club", "Sur approbation")
        }
    }
}

@Composable
fun ImpactScreen(onBack: () -> Unit) {
    ScreenFrame {
        BackHeader("Impact CO₂", "Ledger et économies de mobilité", onBack)
        SgmCard(background = SgmColors.GreenDark) {
            Text("TOTAL ÉCONOMISÉ", color = SgmColors.GreenLight, fontSize = 11.sp, fontWeight = FontWeight.Black)
            Text("12,4 kg CO₂", color = SgmColors.Surface, fontSize = 38.sp, fontWeight = FontWeight.Black)
            Text("24 trajets partagés · estimation v1", color = SgmColors.Surface.copy(alpha = 0.72f), fontWeight = FontWeight.SemiBold)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3)) {
            MetricCard("37 356", "utilisateurs", SgmColors.Green, Modifier.weight(1f))
            MetricCard("182", "km évités", SgmColors.Orange, Modifier.weight(1f))
        }

        SectionHeader("Ledger")
        LedgerRow("Royal Ottignies", "Match U8", "+1,8 kg")
        LedgerRow("Biéreau", "Entraînement", "+0,9 kg")
        LedgerRow("Tennis Club", "Compétition", "+1,2 kg")
    }
}

@Composable
fun RewardsScreen(onBack: () -> Unit) {
    ScreenFrame {
        BackHeader("Récompenses", "Crédits, points et payouts Stripe", onBack)
        SgmCard(background = SgmColors.GreenDark) {
            Text("SOLDE DISPONIBLE", color = SgmColors.GreenLight, fontSize = 11.sp, fontWeight = FontWeight.Black)
            Text("45,40 EUR", color = SgmColors.Surface, fontSize = 40.sp, fontWeight = FontWeight.Black)
            Text("Payouts Stripe Connect · frais plateforme à 0 EUR", color = SgmColors.Surface.copy(alpha = 0.72f), fontWeight = FontWeight.SemiBold)
        }

        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Derniers mouvements")
            FormRow("Trajet Royal Ottignies", "+2,50 EUR")
            FormRow("Bonus CO₂", "+120 points")
            FormRow("Payout demandé", "En attente")
        }

        SgmButton("Configurer Stripe Connect", onClick = {}, fullWidth = true)
    }
}

@Composable
fun ProfileScreen(
    role: AppRole,
    onRoleChange: (AppRole) -> Unit,
    onGroups: () -> Unit,
    onImpact: () -> Unit,
    onRewards: () -> Unit,
    onOptions: () -> Unit,
) {
    ScreenFrame {
        TopBrandBar(
            title = "Profil",
            subtitle = "Compte multi-rôle, enfants et préférences",
            trailing = { Avatar("MR", SgmColors.GreenDark) },
        )

        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Rôle actif")
            RoleSelector(current = role, onSelected = onRoleChange)
        }

        SgmCard(background = SgmColors.Surface) {
            SectionMiniTitle("Enfants")
            ChildRow("Kévin", "U8 Nationaux", "Suivi appareil actif")
            ChildRow("Léo", "U8 Groupe B", "Véhicule uniquement")
        }

        MenuRow("Groupes et clubs", "Royal Ottignies, Biéreau", onGroups)
        MenuRow("Impact CO₂", "12,4 kg économisés", onImpact)
        MenuRow("Récompenses", "45,40 EUR disponibles", onRewards)
        MenuRow("Options", "Localisation, paiements, confidentialité", onOptions)
    }
}

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

@Composable
fun MessageCard(preview: MessagePreview) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(18.dp))
            .padding(SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Avatar(preview.avatar, SgmColors.Green)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(preview.title, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(preview.body, color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Text(preview.time, color = SgmColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Black)
    }
}


data class MessagePreview(
    val title: String,
    val body: String,
    val time: String,
    val avatar: String,
)
