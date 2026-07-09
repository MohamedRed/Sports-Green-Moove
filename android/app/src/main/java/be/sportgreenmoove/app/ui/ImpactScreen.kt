package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
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
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.data.ImpactMonthSummary
import be.sportgreenmoove.app.data.ImpactSummary
import java.util.Locale

@Suppress("UNUSED_PARAMETER")
@Composable
fun ImpactScreen(summary: ImpactSummary, onBack: () -> Unit) {
    V2Screen(testTag = SgmTestTags.ImpactScreen) {
        V2TopBar("MON IMPACT CO²")
        ImpactHero(summary)
        V2SectionLabel("6 DERNIERS MOIS")
        ImpactChart(summary.months)
        V2SectionLabel("MES TRAJETS")
        ImpactTotalsCard(summary)
    }
}

@Composable
private fun ImpactHero(summary: ImpactSummary) {
    Box(
        modifier = Modifier
            .padding(start = 20.dp, top = 4.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(SgmColor.HeroGradient)
            .padding(20.dp),
    ) {
        SgmGridTexture()
        Column {
            Text("CO₂ ÉCONOMISÉ — TOTAL", style = SgmType.Label.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.50f), fontSize = 11.sp, letterSpacing = 0.14.em), modifier = Modifier.padding(bottom = 8.dp))
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(kgValue(summary.totalCo2Kg), style = SgmType.Display4XL.copy(color = SgmColor.Green, fontSize = 64.sp))
                Text("KG", style = SgmType.DisplayXL.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.60f), fontSize = 22.sp), modifier = Modifier.padding(bottom = 8.dp))
            }
            Row(modifier = Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                ImpactHeroMetric("${summary.sharedDistanceKm} km partagés")
                ImpactHeroMetric("${summary.rideCount} trajets")
            }
        }
    }
}

@Composable
private fun ImpactChart(months: List<ImpactMonthSummary>) {
    Row(
        modifier = Modifier
            .padding(start = 20.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(horizontal = 14.dp, vertical = 12.dp)
            .height(110.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (months.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().fillMaxHeight(), contentAlignment = Alignment.Center) {
                Text("Aucun trajet terminé", style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontWeight = FontWeight.SemiBold))
            }
        } else {
            val max = months.maxOf { it.valueKg }.takeIf { it > 0f } ?: 1f
            months.forEachIndexed { index, month ->
                val latest = index == months.lastIndex
                Column(modifier = Modifier.weight(1f).fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                    Text(kgValue(month.valueKg.toDouble()), style = SgmType.BodyXS.copy(color = if (latest) SgmColor.Green else Sgm.colors.textMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold))
                    Box(
                        modifier = Modifier
                            .padding(vertical = 5.dp)
                            .widthIn(max = 30.dp)
                            .fillMaxWidth()
                            .height(((month.valueKg / max) * 70f).coerceAtLeast(4f).dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (latest) SgmColor.Green else Sgm.colors.borderStrong),
                    )
                    Text(month.label, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.04.em))
                }
            }
        }
    }
}

@Composable
private fun ImpactTotalsCard(summary: ImpactSummary) {
    val rows = listOf(
        ImpactMetric("CO₂ économisé", "${kgValue(summary.totalCo2Kg)} kg", progress = 1f),
        ImpactMetric("Distance partagée", "${summary.sharedDistanceKm} km", progress = if (summary.sharedDistanceKm > 0) 1f else 0f),
        ImpactMetric("Trajets clôturés", summary.rideCount.toString(), progress = if (summary.rideCount > 0) 1f else 0f),
    )
    Column(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        rows.forEach { row -> ImpactMetricRow(row) }
    }
}

@Composable
private fun ImpactMetricRow(metric: ImpactMetric) {
    Column {
        Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(bottom = 5.dp)) {
            Text(metric.name, style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.04.em), modifier = Modifier.weight(1f))
            Text(metric.value, style = SgmType.DisplayLG.copy(color = SgmColor.Green, fontSize = 18.sp, letterSpacing = 0.04.em))
        }
        V2ProgressBar(progress = metric.progress)
    }
}

@Composable private fun ImpactHeroMetric(text: String) = Text(text, style = ImpactHeroText())
@Composable private fun ImpactHeroText() = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.70f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
private fun kgValue(value: Double): String = String.format(Locale.FRANCE, "%.1f", value)
private data class ImpactMetric(val name: String, val value: String, val progress: Float)
