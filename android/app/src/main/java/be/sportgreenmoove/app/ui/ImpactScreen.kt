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

private val ImpactMonths = listOf(
    ImpactMonth("JUIN", 1.2f),
    ImpactMonth("JUIL", 0.8f),
    ImpactMonth("AOÛT", 1.6f),
    ImpactMonth("SEPT", 2.4f),
    ImpactMonth("OCT", 3.1f),
    ImpactMonth("NOV", 3.3f),
)

private val ImpactRegions = listOf(
    ImpactRegion("WALLONIE", "37 356", 0.75f),
    ImpactRegion("FLANDRE", "45 784", 0.92f),
    ImpactRegion("BRUXELLES", "29 886", 0.60f),
)

@Suppress("UNUSED_PARAMETER")
@Composable
fun ImpactScreen(onBack: () -> Unit) {
    V2Screen {
        V2TopBar("MON IMPACT CO²")
        ImpactHero()
        V2SectionLabel("6 DERNIERS MOIS")
        ImpactChart()
        V2SectionLabel("LA BELGIQUE EN TEMPS RÉEL")
        ImpactRegionsCard()
    }
}

@Composable
private fun ImpactHero() {
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
                Text("12.4", style = SgmType.Display4XL.copy(color = SgmColor.Green, fontSize = 64.sp))
                Text("KG", style = SgmType.DisplayXL.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.60f), fontSize = 22.sp), modifier = Modifier.padding(bottom = 8.dp))
            }
            Row(modifier = Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                ImpactHeroMetric("≈ 3 arbres plantés")
                ImpactHeroMetric("847 km partagés")
            }
            Text("Rang #47 Belgique", style = ImpactHeroText(), modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
private fun ImpactChart() {
    val max = ImpactMonths.maxOf { it.value }
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
        ImpactMonths.forEachIndexed { index, month ->
            val latest = index == ImpactMonths.lastIndex
            Column(modifier = Modifier.weight(1f).fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                Text(month.value.toString(), style = SgmType.BodyXS.copy(color = if (latest) SgmColor.Green else Sgm.colors.textMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold))
                Box(
                    modifier = Modifier
                        .padding(vertical = 5.dp)
                        .widthIn(max = 30.dp)
                        .fillMaxWidth()
                        .height((month.value / max * 70).dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (latest) SgmColor.Green else Sgm.colors.borderStrong),
                )
                Text(month.label, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.04.em))
            }
        }
    }
}

@Composable
private fun ImpactRegionsCard() {
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
        ImpactRegions.forEach { region -> ImpactRegionRow(region) }
        Text(
            "112 026 utilisateurs actifs · mise à jour en continu",
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun ImpactRegionRow(region: ImpactRegion) {
    Column {
        Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(bottom = 5.dp)) {
            Text(region.name, style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.04.em), modifier = Modifier.weight(1f))
            Text(region.count, style = SgmType.DisplayLG.copy(color = SgmColor.Green, fontSize = 18.sp, letterSpacing = 0.04.em))
        }
        V2ProgressBar(progress = region.progress)
    }
}

@Composable private fun ImpactHeroMetric(text: String) = Text(text, style = ImpactHeroText())
@Composable private fun ImpactHeroText() = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.70f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
private data class ImpactMonth(val label: String, val value: Float)
private data class ImpactRegion(val name: String, val count: String, val progress: Float)
