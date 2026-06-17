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
import be.sportgreenmoove.app.data.RewardEntrySummary
import be.sportgreenmoove.app.data.RewardSummary
import java.util.Locale

@Suppress("UNUSED_PARAMETER")
@Composable
fun RewardsScreen(summary: RewardSummary, onBack: () -> Unit, onWithdraw: () -> Unit = {}) {
    V2Screen(testTag = SgmTestTags.RewardsScreen) {
        V2TopBar("RÉCOMPENSES")
        RewardsHero(summary)
        Box(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 16.dp)) {
            V2Button("RETIRER MES GAINS", onClick = onWithdraw, variant = V2ButtonVariant.Orange, size = V2ButtonSize.Lg, full = true, testTag = SgmTestTags.RewardsWithdrawAction)
        }
        V2SectionLabel("PALIERS")
        Row(modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            rewardTiers(summary).forEach { tier -> RewardTierCard(tier, modifier = Modifier.weight(1f)) }
        }
        V2SectionLabel("HISTORIQUE")
        RewardsHistoryCard(summary.entries)
    }
}

@Composable
private fun RewardsHero(summary: RewardSummary) {
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
                Text(moneyValue(summary.balanceCents), style = SgmType.Display4XL.copy(color = SgmColor.Orange, fontSize = 60.sp))
                Text("€", style = SgmType.DisplayXL.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.60f), fontSize = 26.sp), modifier = Modifier.padding(bottom = 6.dp))
            }
            Box(Modifier.padding(top = 14.dp)) {
                V2ProgressBar(progress = summary.progress.coerceIn(0f, 1f))
            }
            Row(modifier = Modifier.padding(top = 5.dp)) {
                Text("Prochain palier : ${moneyLabel(summary.nextTierCents)}", style = RewardsHeroMeta(), modifier = Modifier.weight(1f))
                Text(percentLabel(summary.progress), style = RewardsHeroMeta())
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
private fun RewardsHistoryCard(entries: List<RewardEntrySummary>) {
    Column(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG)),
    ) {
        if (entries.isEmpty()) {
            Text(
                "Aucun mouvement enregistré",
                style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontWeight = FontWeight.SemiBold),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 18.dp),
            )
        } else {
            entries.forEachIndexed { index, entry ->
                RewardHistoryRow(entry, showDivider = index < entries.lastIndex)
            }
        }
    }
}

@Composable
private fun RewardHistoryRow(entry: RewardEntrySummary, showDivider: Boolean) {
    val color = if (entry.positive) SgmColor.Green else SgmColor.Orange
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
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                SgmLineIcon(SgmIcon.Leaf, tint = color, modifier = Modifier.size(15.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(entry.title, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(entry.dateLabel, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium))
            }
            Text(entry.amountLabel, style = SgmType.DisplayLG.copy(color = color, fontSize = 16.sp))
        }
        if (showDivider) Box(Modifier.padding(start = 60.dp).fillMaxWidth().height(1.dp).background(Sgm.colors.border))
    }
}

@Composable private fun RewardsHeroMeta() = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.55f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
private fun rewardTiers(summary: RewardSummary): List<RewardTier> =
    listOf(500, 1_000, 2_500, 5_000).map { cents ->
        val reached = summary.balanceCents >= cents
        RewardTier(moneyLabel(cents), reached = reached, current = !reached && summary.nextTierCents == cents)
    }

private fun moneyValue(cents: Int): String {
    val sign = if (cents < 0) "-" else ""
    val abs = kotlin.math.abs(cents)
    return String.format(Locale.FRANCE, "%s%d,%02d", sign, abs / 100, abs % 100)
}

private fun moneyLabel(cents: Int): String = "${moneyValue(cents)}€"
private fun percentLabel(progress: Float): String = "${(progress.coerceIn(0f, 1f) * 100).toInt()}%"
private data class RewardTier(val amount: String, val reached: Boolean, val current: Boolean)
