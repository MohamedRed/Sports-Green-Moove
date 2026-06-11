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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

private val RewardTiers = listOf(
    RewardTier("5€", reached = true, current = false),
    RewardTier("10€", reached = false, current = true),
    RewardTier("25€", reached = false, current = false),
    RewardTier("50€", reached = false, current = false),
)

private val RewardHistory = listOf(
    RewardEntry("U8 vs Royal Ottignies SC", "07 NOV 2022", "+0.50€"),
    RewardEntry("Entraînement U8 — Groupe B", "03 NOV 2022", "+0.50€"),
    RewardEntry("U8 vs FC Bruges", "29 OCT 2022", "+0.75€"),
    RewardEntry("Entraînement U8 — Groupe A", "24 OCT 2022", "+0.50€"),
    RewardEntry("Match Tennis — Catégorie B", "22 OCT 2022", "+0.40€"),
)

@Suppress("UNUSED_PARAMETER")
@Composable
fun RewardsScreen(onBack: () -> Unit) {
    V2Screen {
        V2TopBar("RÉCOMPENSES")
        RewardsHero()
        Box(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 16.dp)) {
            V2Button("RETIRER MES GAINS", onClick = {}, variant = V2ButtonVariant.Orange, size = V2ButtonSize.Lg, full = true)
        }
        V2SectionLabel("PALIERS")
        Row(modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RewardTiers.forEach { tier -> RewardTierCard(tier, modifier = Modifier.weight(1f)) }
        }
        V2SectionLabel("HISTORIQUE")
        RewardsHistoryCard()
    }
}

@Composable
private fun RewardsHero() {
    Box(
        modifier = Modifier
            .padding(start = 20.dp, top = 4.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(SgmColor.RewardGradient)
            .padding(20.dp),
    ) {
        SgmGridTexture(lineColor = SgmColor.Orange.copy(alpha = 0.06f))
        Column {
            Text("SOLDE GREEN-MOOVER", style = SgmType.Label.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.50f), fontSize = 11.sp, letterSpacing = 0.14.em), modifier = Modifier.padding(bottom = 8.dp))
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("7.50", style = SgmType.Display4XL.copy(color = SgmColor.Orange, fontSize = 60.sp))
                Text("€", style = SgmType.DisplayXL.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.60f), fontSize = 26.sp), modifier = Modifier.padding(bottom = 6.dp))
            }
            Box(Modifier.padding(top = 14.dp)) {
                V2ProgressBar(progress = 0.75f)
            }
            Row(modifier = Modifier.padding(top = 5.dp)) {
                Text("Prochain palier : 10€", style = RewardsHeroMeta(), modifier = Modifier.weight(1f))
                Text("75%", style = RewardsHeroMeta())
            }
        }
    }
}

@Composable
private fun RewardTierCard(tier: RewardTier, modifier: Modifier = Modifier) {
    val accent = when {
        tier.reached -> SgmColor.Green
        tier.current -> SgmColor.Orange
        else -> Sgm.colors.border
    }
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (tier.current) SgmColor.Orange.copy(alpha = 0.10f) else Sgm.colors.bgCard)
            .border(BorderStroke(1.5.dp, accent), RoundedCornerShape(14.dp))
            .padding(horizontal = 8.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(tier.amount, style = SgmType.DisplayXL.copy(color = if (tier.reached) SgmColor.Green else if (tier.current) SgmColor.Orange else Sgm.colors.textMuted, fontSize = 22.sp))
        Text(
            when {
                tier.reached -> "Atteint"
                tier.current -> "En cours"
                else -> "À venir"
            },
            style = SgmType.BodyXS.copy(color = if (tier.reached) SgmColor.Green else if (tier.current) SgmColor.Orange else Sgm.colors.textMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold),
        )
    }
}

@Composable
private fun RewardsHistoryCard() {
    Column(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG)),
    ) {
        RewardHistory.forEachIndexed { index, entry ->
            RewardHistoryRow(entry, showDivider = index < RewardHistory.lastIndex)
        }
    }
}

@Composable
private fun RewardHistoryRow(entry: RewardEntry, showDivider: Boolean) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(SgmColor.Green.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                SgmLineIcon(SgmIcon.Leaf, tint = SgmColor.Green, modifier = Modifier.size(15.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(entry.event, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(entry.date, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium))
            }
            Text(entry.amount, style = SgmType.DisplayLG.copy(color = SgmColor.Green, fontSize = 16.sp))
        }
        if (showDivider) Box(Modifier.padding(start = 60.dp).fillMaxWidth().height(1.dp).background(Sgm.colors.border))
    }
}

@Composable private fun RewardsHeroMeta() = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.55f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
private data class RewardTier(val amount: String, val reached: Boolean, val current: Boolean)
private data class RewardEntry(val event: String, val date: String, val amount: String)
