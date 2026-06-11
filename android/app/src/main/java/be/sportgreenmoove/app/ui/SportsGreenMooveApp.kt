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
import androidx.compose.material3.MaterialTheme
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
import be.sportgreenmoove.app.services.MockFirebaseGateway
import be.sportgreenmoove.app.services.MockRadarTrackingGateway
import kotlinx.coroutines.launch

@Composable
fun SportsGreenMooveApp() {
    val firebase = remember { MockFirebaseGateway() }
    val radar = remember { MockRadarTrackingGateway() }
    val scope = rememberCoroutineScope()
    var screen by remember { mutableStateOf(DemoScreen.Home) }
    var role by remember { mutableStateOf(AppRole.Parent) }
    var trips by remember { mutableStateOf(emptyList<TripSummary>()) }
    var activeRide by remember { mutableStateOf<LiveRideSnapshot?>(null) }

    LaunchedEffect(Unit) {
        trips = firebase.searchTrips()
    }

    val displayTrips = remember(trips) { enrichTrips(trips) }

    MaterialTheme {
        Scaffold(
            containerColor = SgmColors.AppBackground,
            bottomBar = {
                AppBottomBar(
                    current = screen.toTopLevel(),
                    onNavigate = { destination -> screen = destination },
                )
            },
        ) { padding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(SgmColors.AppBackground)
                    .padding(padding),
            ) {
                when (screen) {
                    DemoScreen.Home -> HomeScreen(
                        role = role,
                        trips = displayTrips,
                        onTrips = { screen = DemoScreen.Trips },
                        onRide = { screen = DemoScreen.Ride },
                        onSearch = { screen = DemoScreen.Search },
                        onGroups = { screen = DemoScreen.Groups },
                        onImpact = { screen = DemoScreen.Impact },
                    )

                    DemoScreen.Trips -> TripsScreen(
                        trips = displayTrips,
                        activeRide = activeRide,
                        onStartRide = {
                            scope.launch {
                                val trip = displayTrips.firstOrNull() ?: return@launch
                                val ride = firebase.startRide(trip.id)
                                radar.startTripTracking(ride.rideSessionId, role)
                                activeRide = ride
                                screen = DemoScreen.Ride
                            }
                        },
                        onOpenSearch = { screen = DemoScreen.Search },
                    )

                    DemoScreen.Publish -> PublishScreen(role = role)
                    DemoScreen.Messages -> MessagesScreen()
                    DemoScreen.Profile -> ProfileScreen(
                        role = role,
                        onRoleChange = { role = it },
                        onGroups = { screen = DemoScreen.Groups },
                        onImpact = { screen = DemoScreen.Impact },
                        onRewards = { screen = DemoScreen.Rewards },
                        onOptions = { screen = DemoScreen.Options },
                    )

                    DemoScreen.Search -> SearchScreen(trips = displayTrips, onBack = { screen = DemoScreen.Home })
                    DemoScreen.Groups -> GroupsScreen(onBack = { screen = DemoScreen.Profile })
                    DemoScreen.Impact -> ImpactScreen(onBack = { screen = DemoScreen.Profile })
                    DemoScreen.Rewards -> RewardsScreen(onBack = { screen = DemoScreen.Profile })
                    DemoScreen.Options -> OptionsScreen(onBack = { screen = DemoScreen.Profile })
                    DemoScreen.Ride -> RideMonitorScreen(
                        activeRide = activeRide,
                        onBack = { screen = DemoScreen.Trips },
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(
    role: AppRole,
    trips: List<TripSummary>,
    onTrips: () -> Unit,
    onRide: () -> Unit,
    onSearch: () -> Unit,
    onGroups: () -> Unit,
    onImpact: () -> Unit,
) {
    ScreenFrame {
        HomeHeader()

        HomeHeroCard(onPrimary = onRide)

        Row(horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            HomeMetricCard("12,4", "kg", "CO₂ économisé", SgmColors.Green, Modifier.weight(1f))
            HomeMetricCard("24", "trajets", "partagés", SgmColors.Orange, Modifier.weight(1f))
            HomeMetricCard("847", "km", "parcourus", SgmColors.Green, Modifier.weight(1f))
        }

        SectionHeader("Semaine à venir", action = "Tout voir", onAction = onTrips)
        trips.take(2).forEach { trip ->
            HomeTripCard(trip = trip, onClick = onTrips)
        }

        SgmCard(background = SgmColors.Surface) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
                    Text("Profil actuel", color = SgmColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    Text(roleLabel(role), color = SgmColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                }
                Pill("Multi-rôle", selected = true)
            }
        }

        ImpactStrip(onClick = onImpact)

        Row(horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3)) {
            ActionTile("Recherche", "Trouver un trajet", "R", onSearch, Modifier.weight(1f))
            ActionTile("Groupes", "Clubs & équipes", "G", onGroups, Modifier.weight(1f))
        }
    }
}

@Composable
private fun TripsScreen(
    trips: List<TripSummary>,
    activeRide: LiveRideSnapshot?,
    onStartRide: () -> Unit,
    onOpenSearch: () -> Unit,
) {
    var selectedTab by remember { mutableStateOf("À VENIR") }

    ScreenFrame {
        TopBrandBar(
            title = "Green-List",
            subtitle = "Trajets proposés, réservés et suivis",
            trailing = { HeaderCircle("GL") },
        )
        SegmentedTabs(
            options = listOf("À VENIR", "PASSÉS", "EN ATTENTE"),
            selected = selectedTab,
            onSelected = { selectedTab = it },
        )

        if (activeRide == null) {
            SgmCard(background = SgmColors.GreenDark) {
                Text("SUIVI EN DIRECT", color = SgmColors.GreenLight, fontSize = 11.sp, fontWeight = FontWeight.Black)
                Text("Aucune course active", color = SgmColors.Surface, fontSize = 24.sp, fontWeight = FontWeight.Black)
                Text(
                    "Démarre le suivi au départ pour partager véhicule, enfant, ETA et statuts avec le parent.",
                    color = SgmColors.Surface.copy(alpha = 0.72f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                SgmButton("Démarrer le suivi", onStartRide, fullWidth = true, light = true)
            }
        } else {
            LiveRideCard(ride = activeRide, onClick = onStartRide)
        }

        SectionHeader("Trajets recommandés", action = "Filtrer", onAction = onOpenSearch)
        trips.forEachIndexed { index, trip ->
            TripCard(trip = trip, highlight = index == 0, onClick = onStartRide)
        }
    }
}

@Composable
private fun PublishScreen(role: AppRole) {
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
private fun SearchScreen(trips: List<TripSummary>, onBack: () -> Unit) {
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

@Composable
private fun MessagesScreen() {
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
private fun GroupsScreen(onBack: () -> Unit) {
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
private fun ImpactScreen(onBack: () -> Unit) {
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
private fun RewardsScreen(onBack: () -> Unit) {
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
private fun ProfileScreen(
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
private fun OptionsScreen(onBack: () -> Unit) {
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
private fun RideMonitorScreen(activeRide: LiveRideSnapshot?, onBack: () -> Unit) {
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
private fun ScreenFrame(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = SgmSpacing.X4, vertical = SgmSpacing.X4)
            .padding(bottom = SgmSpacing.X6),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
        content = content,
    )
}

@Composable
private fun HomeHeader() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("Bonjour, ", color = SgmColors.TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black)
                    Text("Olivier", color = SgmColors.Green, fontSize = 15.sp, fontWeight = FontWeight.Black)
                }
                Text(
                    "Mardi 07 Novembre 2022",
                    color = SgmColors.TextMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            MiniHeaderCircle("C")
        }
        Wordmark(large = true)
    }
}

@Composable
private fun HomeHeroCard(onPrimary: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(142.dp)
            .clip(RoundedCornerShape(15.dp))
            .clickable(onClick = onPrimary)
            .background(Brush.linearGradient(listOf(SgmColors.HeroStart, SgmColors.HeroEnd))),
    ) {
        GridAccent(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = SgmSpacing.X3, end = SgmSpacing.X3),
            cellSize = 10,
            alpha = 0.07f,
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = SgmSpacing.X4, vertical = SgmSpacing.X3),
            verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2),
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(SgmColors.Green)
                    .padding(horizontal = SgmSpacing.X3, vertical = 3.dp),
            ) {
                Text(
                    "PROCHAINE\nCOURSE",
                    color = SgmColors.Surface,
                    fontSize = 9.sp,
                    lineHeight = 8.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp,
                )
            }
            Spacer(Modifier.weight(1f))
            Text(
                "U8 NATIONAUX VS\nROYAL OTTIGNIES SC",
                color = SgmColors.Surface,
                fontSize = 23.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.Black,
                maxLines = 2,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3)) {
                Text("07 NOV ·\n16h45", color = SgmColors.Surface.copy(alpha = 0.82f), fontSize = 10.sp, lineHeight = 10.sp, fontWeight = FontWeight.Black)
                Text("5.2 km · 2\npassagers", color = SgmColors.Surface.copy(alpha = 0.82f), fontSize = 10.sp, lineHeight = 10.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun HomeMetricCard(value: String, unit: String, label: String, accent: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .height(76.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(12.dp))
            .padding(vertical = SgmSpacing.X2, horizontal = SgmSpacing.X1),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, color = accent, fontSize = 26.sp, lineHeight = 24.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, maxLines = 1)
        Text(unit, color = SgmColors.TextMuted, fontSize = 10.sp, lineHeight = 10.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
        Text(label, color = SgmColors.TextMuted, fontSize = 9.sp, lineHeight = 9.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
    }
}

@Composable
private fun HomeTripCard(trip: TripSummary, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(SgmColors.HeroStart)
                .padding(horizontal = SgmSpacing.X3, vertical = SgmSpacing.X2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(trip.category.replace("U8", "Football"), color = SgmColors.GreenLight, fontSize = 10.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            Text(trip.departureLabel.replace(" · ", " ·\n"), color = SgmColors.Surface, fontSize = 10.sp, lineHeight = 10.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.End)
        }
        Column(
            modifier = Modifier.padding(horizontal = SgmSpacing.X3, vertical = SgmSpacing.X2),
            verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2),
        ) {
            Text(trip.title, color = SgmColors.TextPrimary, fontSize = 15.sp, lineHeight = 16.sp, fontWeight = FontWeight.Black, maxLines = 2)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
                Text("5.2 km", color = SgmColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Text("${trip.seatsAvailable} places", color = SgmColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                SmallBadge("GO", SgmColors.Green)
            }
        }
    }
}

@Composable
private fun TopBrandBar(
    title: String,
    subtitle: String,
    trailing: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            Wordmark()
            Text(title, color = SgmColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = SgmColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        trailing()
    }
}

@Composable
private fun BackHeader(title: String, subtitle: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(SgmColors.Surface)
                .border(BorderStroke(1.dp, SgmColors.Border), CircleShape)
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Text("<", color = SgmColors.TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Wordmark()
            Text(title, color = SgmColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = SgmColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun Wordmark(large: Boolean = false) {
    val base = if (large) 17.sp else 13.sp
    val mid = if (large) 21.sp else 18.sp
    val oo = if (large) 32.sp else 27.sp
    Row(verticalAlignment = Alignment.Bottom) {
        Text("SPORTS ", color = SgmColors.TextMuted, fontSize = base, fontWeight = FontWeight.Black)
        Text("GREEN-", color = SgmColors.Green, fontSize = base, fontWeight = FontWeight.Black)
        Text("m", color = SgmColors.TextPrimary, fontSize = mid, fontWeight = FontWeight.Black)
        Text("OO", color = SgmColors.Green, fontSize = oo, fontWeight = FontWeight.Black)
        Text("Ve", color = SgmColors.TextPrimary, fontSize = mid, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun HeroCard(
    kicker: String,
    title: String,
    detail: String,
    primary: String,
    secondary: String,
    onPrimary: () -> Unit,
    onSecondary: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(SgmColors.GreenDark),
    ) {
        GridAccent(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(SgmSpacing.X4),
        )
        Column(
            modifier = Modifier.padding(SgmSpacing.X5),
            verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
        ) {
            Text(kicker, color = SgmColors.GreenLight, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Text(title, color = SgmColors.Surface, fontSize = 30.sp, lineHeight = 31.sp, fontWeight = FontWeight.Black)
            Text(detail, color = SgmColors.Surface.copy(alpha = 0.76f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
                SgmButton(primary, onPrimary, modifier = Modifier.weight(1f), light = true)
                SgmButton(secondary, onSecondary, modifier = Modifier.weight(1f), secondary = true)
            }
        }
    }
}

@Composable
private fun GridAccent(modifier: Modifier = Modifier, cellSize: Int = 14, alpha: Float = 0.08f) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy((cellSize / 2).dp)) {
        repeat(5) {
            Row(horizontalArrangement = Arrangement.spacedBy((cellSize / 2).dp)) {
                repeat(4) {
                    Box(
                        modifier = Modifier
                            .size(cellSize.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(SgmColors.Surface.copy(alpha = alpha)),
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title.uppercase(),
            color = SgmColors.TextPrimary,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp,
            modifier = Modifier.weight(1f),
        )
        if (action != null && onAction != null) {
            Text(
                action.uppercase(),
                color = SgmColors.Green,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.clickable(onClick = onAction),
            )
        }
    }
}

@Composable
private fun SectionMiniTitle(title: String) {
    Text(
        title.uppercase(),
        color = SgmColors.TextPrimary,
        fontSize = 14.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 1.sp,
    )
}

@Composable
private fun SgmCard(
    modifier: Modifier = Modifier,
    background: Color = SgmColors.Card,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(background)
            .padding(SgmSpacing.X4),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
        content = content,
    )
}

@Composable
private fun TripCard(trip: TripSummary, highlight: Boolean, onClick: () -> Unit) {
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
private fun MatchCard(score: String, trip: TripSummary) {
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
private fun LiveRideCard(ride: LiveRideSnapshot, onClick: () -> Unit) {
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
private fun MapPanel() {
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
private fun RouteDot(modifier: Modifier, text: String) {
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
private fun MetricCard(value: String, label: String, accent: Color, modifier: Modifier = Modifier) {
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
private fun ActionTile(title: String, subtitle: String, mark: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    SgmCard(
        modifier = modifier.clickable(onClick = onClick),
        background = SgmColors.Surface,
    ) {
        HeaderCircle(mark)
        Text(title, color = SgmColors.TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
        Text(subtitle, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ImpactStrip(onClick: () -> Unit) {
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

@Composable
private fun SegmentedTabs(options: List<String>, selected: String, onSelected: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SgmColors.Card)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEach { option ->
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(42.dp)
                    .clip(RoundedCornerShape(13.dp))
                    .background(if (selected == option) SgmColors.Surface else Color.Transparent)
                    .clickable { onSelected(option) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option,
                    color = if (selected == option) SgmColors.GreenDark else SgmColors.TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun SearchBox(placeholder: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(58.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(18.dp))
            .padding(horizontal = SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        HeaderCircle("S")
        Text(placeholder, color = SgmColors.TextMuted, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun MessageCard(preview: MessagePreview) {
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

@Composable
private fun GroupCard(club: String, team: String, members: String, status: String, selected: Boolean) {
    SgmCard(background = if (selected) SgmColors.Card else SgmColors.Surface) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3)) {
            HeaderCircle(club.take(2).uppercase())
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
                Text(club, color = SgmColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text("$team · $members", color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Pill(status, selected = selected)
        }
    }
}

@Composable
private fun LedgerRow(source: String, detail: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(16.dp))
            .padding(SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(source, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(detail, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(value, color = SgmColors.Green, fontSize = 16.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun RoleSelector(current: AppRole, onSelected: (AppRole) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            RolePill(AppRole.Parent, current, onSelected, Modifier.weight(1f))
            RolePill(AppRole.Driver, current, onSelected, Modifier.weight(1f))
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            RolePill(AppRole.Child, current, onSelected, Modifier.weight(1f))
            RolePill(AppRole.ClubManager, current, onSelected, Modifier.weight(1f))
        }
    }
}

@Composable
private fun RolePill(role: AppRole, current: AppRole, onSelected: (AppRole) -> Unit, modifier: Modifier = Modifier) {
    val selected = current == role
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) SgmColors.Green else SgmColors.Card)
            .clickable { onSelected(role) },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            roleLabel(role),
            color = if (selected) SgmColors.Surface else SgmColors.TextSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ChildRow(name: String, subtitle: String, status: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Avatar(name.take(1), SgmColors.GreenDark)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(name, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(status, color = SgmColors.Green, fontSize = 11.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.End)
    }
}

@Composable
private fun MenuRow(title: String, detail: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(title, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(detail, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(">", color = SgmColors.Green, fontSize = 18.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun FormRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SgmColors.Input)
            .padding(horizontal = SgmSpacing.X3, vertical = SgmSpacing.X3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = SgmColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Text(value, color = SgmColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.End)
    }
}

@Composable
private fun StatusPanel(title: String, body: String, accent: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(accent.copy(alpha = 0.12f))
            .border(BorderStroke(1.dp, accent.copy(alpha = 0.28f)), RoundedCornerShape(18.dp))
            .padding(SgmSpacing.X4),
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HeaderCircle(title.take(1), accent)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(title, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(body, color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun Pill(text: String, selected: Boolean) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) SgmColors.Green.copy(alpha = 0.16f) else SgmColors.Surface)
            .border(BorderStroke(1.dp, if (selected) SgmColors.Green.copy(alpha = 0.28f) else SgmColors.Border), RoundedCornerShape(999.dp))
            .padding(horizontal = SgmSpacing.X3, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            color = if (selected) SgmColors.GreenDark else SgmColors.TextMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
        )
    }
}

@Composable
private fun SmallBadge(text: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = SgmSpacing.X2, vertical = SgmSpacing.X1),
    ) {
        Text(text, color = color, fontSize = 11.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun SgmButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fullWidth: Boolean = false,
    light: Boolean = false,
    secondary: Boolean = false,
) {
    val container = when {
        light -> SgmColors.Surface
        secondary -> SgmColors.Surface.copy(alpha = 0.14f)
        else -> SgmColors.Green
    }
    val content = when {
        light -> SgmColors.GreenDark
        else -> SgmColors.Surface
    }
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = container, contentColor = content),
        shape = RoundedCornerShape(14.dp),
        modifier = modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .height(48.dp),
    ) {
        Text(title.uppercase(), fontWeight = FontWeight.Black, fontSize = 12.sp, letterSpacing = 0.5.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun Avatar(text: String, color: Color) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(color),
        contentAlignment = Alignment.Center,
    ) {
        Text(text.take(2).uppercase(), color = SgmColors.Surface, fontSize = 14.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun HeaderCircle(text: String, color: Color = SgmColors.Green) {
    Box(
        modifier = Modifier
            .size(46.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = 0.14f))
            .border(BorderStroke(1.dp, color.copy(alpha = 0.26f)), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(text.take(2).uppercase(), color = color, fontSize = 13.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun MiniHeaderCircle(text: String) {
    Box(
        modifier = Modifier
            .size(30.dp)
            .clip(CircleShape)
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(text.take(1).uppercase(), color = SgmColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun AppBottomBar(current: DemoScreen, onNavigate: (DemoScreen) -> Unit) {
    val items = listOf(
        NavItem(DemoScreen.Home, "Accueil", "A"),
        NavItem(DemoScreen.Trips, "Trajets", "T"),
        NavItem(DemoScreen.Publish, "Publier", "+"),
        NavItem(DemoScreen.Messages, "Chats", "C"),
        NavItem(DemoScreen.Profile, "Profil", "P"),
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(78.dp)
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border))
            .padding(horizontal = SgmSpacing.X3, vertical = SgmSpacing.X2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X1),
    ) {
        items.forEach { item ->
            BottomNavButton(item = item, selected = current == item.screen, onClick = { onNavigate(item.screen) }, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun BottomNavButton(item: NavItem, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val isPublish = item.screen == DemoScreen.Publish
    Column(
        modifier = modifier
            .height(62.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected && !isPublish) SgmColors.Card else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(if (isPublish) 44.dp else 30.dp)
                .clip(CircleShape)
                .background(
                    when {
                        isPublish -> SgmColors.Green
                        selected -> SgmColors.Green.copy(alpha = 0.16f)
                        else -> SgmColors.Input
                    },
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                item.mark,
                color = if (isPublish) SgmColors.Surface else if (selected) SgmColors.GreenDark else SgmColors.TextMuted,
                fontSize = if (isPublish) 24.sp else 12.sp,
                fontWeight = FontWeight.Black,
            )
        }
        if (!isPublish) {
            Spacer(Modifier.height(2.dp))
            Text(
                item.label,
                color = if (selected) SgmColors.GreenDark else SgmColors.TextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                maxLines = 1,
            )
        }
    }
}

private fun DemoScreen.toTopLevel(): DemoScreen =
    when (this) {
        DemoScreen.Search -> DemoScreen.Home
        DemoScreen.Groups, DemoScreen.Impact, DemoScreen.Rewards, DemoScreen.Options -> DemoScreen.Profile
        DemoScreen.Ride -> DemoScreen.Trips
        else -> this
    }

private fun roleLabel(role: AppRole): String =
    when (role) {
        AppRole.Parent -> "Parent"
        AppRole.Driver -> "Conducteur"
        AppRole.Child -> "Enfant"
        AppRole.ClubManager -> "Club manager"
        AppRole.Admin -> "Admin"
    }

private fun enrichTrips(source: List<TripSummary>): List<TripSummary> {
    val fallback = if (source.isEmpty()) {
        listOf(
            TripSummary(
                id = "trip-u8-royal",
                title = "U8 NATIONAUX VS ROYAL OTTIGNIES SC",
                club = "Royal Ottignies",
                category = "U8",
                departureLabel = "07 NOV · 16h45",
                seatsAvailable = 2,
                priceLabel = "2,50 EUR",
                reasons = listOf("+6 min détour", "2 places disponibles", "Même équipe U8", "Suivi enfant disponible"),
            ),
            TripSummary(
                id = "trip-biereau",
                title = "ENTRAÎNEMENT U8 GROUPE B",
                club = "Collège du Biéreau",
                category = "U8",
                departureLabel = "10 NOV · 18h00",
                seatsAvailable = 1,
                priceLabel = "Gratuit",
                reasons = listOf("+9 min détour", "Même club", "Trajet gratuit"),
            ),
        )
    } else {
        source
    }

    return fallback + listOf(
        TripSummary(
            id = "trip-bruges",
            title = "U8 VS FOOTBALL CLUB DE BRUGES",
            club = "Royal Ottignies",
            category = "U8",
            departureLabel = "12 NOV · 09h15",
            seatsAvailable = 3,
            priceLabel = "4,00 EUR",
            reasons = listOf("+11 min détour", "Même équipe", "Retour proposé"),
        ),
        TripSummary(
            id = "trip-tennis",
            title = "COMPÉTITION JUNIOR TENNIS",
            club = "Louvain Tennis Club",
            category = "JUNIOR",
            departureLabel = "13 NOV · 13h20",
            seatsAvailable = 1,
            priceLabel = "3,00 EUR",
            reasons = listOf("+4 min détour", "Conducteur 4,9", "CO₂ +1,2 kg"),
        ),
        TripSummary(
            id = "trip-natation",
            title = "ENTRAÎNEMENT NATATION",
            club = "Blocry",
            category = "U10",
            departureLabel = "14 NOV · 17h30",
            seatsAvailable = 2,
            priceLabel = "2,00 EUR",
            reasons = listOf("+7 min détour", "Arrivée 10 min avant", "Suivi véhicule"),
        ),
    )
}

private enum class DemoScreen {
    Home,
    Trips,
    Publish,
    Messages,
    Profile,
    Search,
    Groups,
    Impact,
    Rewards,
    Options,
    Ride,
}

private data class NavItem(
    val screen: DemoScreen,
    val label: String,
    val mark: String,
)

private data class MessagePreview(
    val title: String,
    val body: String,
    val time: String,
    val avatar: String,
)
