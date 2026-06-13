package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun GroupsScreen(clubs: List<ClubSummary>, onBack: () -> Unit) {
    var requested by remember { mutableStateOf(setOf<String>()) }
    val memberships = clubs.filter { it.isMember }
    val suggestions = clubs.filterNot { it.isMember }
    V2Screen(testTag = SgmTestTags.GroupsScreen) {
        V2TopBar("GROUPES")
        V2SectionLabel("MES CLUBS")
        Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (memberships.isEmpty()) GroupEmptyRow("Aucun club lié à votre compte.")
            memberships.forEach { club -> MyClubCard(club) }
        }
        V2SectionLabel("DÉCOUVRIR DES CLUBS")
        Column(modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (suggestions.isEmpty()) GroupEmptyRow("Aucun club public disponible.")
            suggestions.forEach { club ->
                SuggestedClubRow(
                    club = club,
                    requested = club.id in requested,
                    onJoin = { requested = requested + club.id },
                )
            }
        }
        Box(
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .border(BorderStroke(1.5.dp, Sgm.colors.borderStrong), RoundedCornerShape(14.dp))
                .padding(14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("+ Créer un nouveau groupe", style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold))
        }
    }
}

@Composable
private fun MyClubCard(club: ClubSummary) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ClubInitials(club.initials, large = true)
            Column(modifier = Modifier.weight(1f)) {
                Text(club.name, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${club.sport} · ${club.memberCount} membres", style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium))
            }
            ClubRolePill(club.roleLabel ?: "MEMBRE")
        }
        Row(modifier = Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
                club.memberInitials.forEach { initials -> V2Avatar(initials, size = 26) }
            }
            val hiddenMembers = (club.memberCount - club.memberInitials.size).coerceAtLeast(0)
            Text("+$hiddenMembers greens-moovers", style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.padding(start = 8.dp))
            Spacer(Modifier.weight(1f))
            Text("Voir →", style = SgmType.BodyXS.copy(color = SgmColor.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold))
        }
    }
}

@Composable
private fun SuggestedClubRow(club: ClubSummary, requested: Boolean, onJoin: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ClubInitials(club.initials, large = false)
        Column(modifier = Modifier.weight(1f)) {
            Text(club.name, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${club.sport} · ${club.memberCount} membres", style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium))
        }
        if (requested) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SgmLineIcon(SgmIcon.Check, tint = SgmColor.Green, modifier = Modifier.size(14.dp))
                Text("Demandé", style = SgmType.BodyXS.copy(color = SgmColor.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold))
            }
        } else {
            V2Button("Rejoindre", onClick = onJoin, variant = V2ButtonVariant.Ghost, size = V2ButtonSize.Sm, testTag = SgmTestTags.GroupsJoinAction)
        }
    }
}

@Composable
private fun GroupEmptyRow(text: String) {
    Text(
        text,
        style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(14.dp))
            .padding(14.dp),
    )
}

@Composable
private fun ClubInitials(initials: String, large: Boolean) {
    Box(
        modifier = Modifier
            .size(if (large) 46.dp else 40.dp)
            .clip(RoundedCornerShape(if (large) 12.dp else 10.dp))
            .background(if (large) Brush.linearGradient(listOf(SgmColor.GreenDark, SgmColor.Green)) else Brush.linearGradient(listOf(Sgm.colors.bgElevated, Sgm.colors.bgElevated)))
            .then(if (large) Modifier else Modifier.border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(10.dp))),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials, style = SgmType.DisplayLG.copy(color = if (large) SgmColor.TextOnGreen else Sgm.colors.textSecondary, fontSize = if (large) 18.sp else 15.sp))
    }
}

@Composable
private fun ClubRolePill(role: String) {
    Box(modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(SgmColor.Green.copy(alpha = 0.14f)).padding(horizontal = 10.dp, vertical = 3.dp)) {
        Text(role, style = SgmType.Label.copy(color = SgmColor.Green, fontSize = 10.sp, letterSpacing = 0.06.em))
    }
}
