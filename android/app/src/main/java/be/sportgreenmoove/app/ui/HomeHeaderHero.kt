package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmType

@Composable
fun HomeHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 10.dp, end = 20.dp, bottom = 6.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text("Bonjour, ", style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold))
                Text("Olivier", style = SgmType.BodyBase.copy(color = SgmColor.Green, fontWeight = FontWeight.Bold))
            }
            Text(
                "Mardi 07 Novembre 2022",
                style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontWeight = FontWeight.Medium),
            )
        }
        HeaderThemeButton()
    }
    Box(modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp)) {
        SgmWordmark()
    }
}

@Composable
fun HomeHeroCard(trip: TripSummary?, onClick: () -> Unit) {
    val gridSpacing = with(LocalDensity.current) { 28.dp.toPx() }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .height(172.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(SgmColor.HeroGradient)
            .clickable(onClick = onClick),
    ) {
        SgmGridTexture(spacing = gridSpacing)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 16.dp, top = 14.dp, end = 16.dp, bottom = 14.dp),
        ) {
            HomeHeroBadge()
            Spacer(Modifier.weight(1f))
            Text(
                trip?.title ?: "AUCUN TRAJET PUBLIÉ",
                style = SgmType.DisplayLG.copy(color = SgmColor.TextOnGreen, fontSize = 18.sp, lineHeight = 20.sp, letterSpacing = 0.03.em),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(5.dp))
            Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
                Text(trip?.departureLabel ?: "DATE À CONFIRMER", style = SgmType.BodyXS.copy(color = SgmColor.GreenLight, fontWeight = FontWeight.Bold))
                Text("${trip?.distanceLabel ?: "Distance à confirmer"} · ${trip?.seatsLabel ?: "0 place"}", style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.62f), fontWeight = FontWeight.Medium))
            }
        }
    }
}

@Composable
private fun HeaderThemeButton() {
    V2ThemeButton()
}

@Composable
private fun SgmWordmark() {
    Row(verticalAlignment = Alignment.Bottom) {
        WordmarkText("SPORTS ", SgmType.DisplayLG.copy(fontSize = 18.sp, letterSpacing = 0.10.em), Sgm.colors.textMuted)
        WordmarkText("GREEN-", SgmType.DisplayLG.copy(fontSize = 18.sp, letterSpacing = 0.08.em), SgmColor.Green)
        WordmarkText("m", SgmType.DisplayXL.copy(fontSize = 24.sp), Sgm.colors.textPrimary)
        WordmarkText("OO", SgmType.Display2XL.copy(fontSize = 36.sp, lineHeight = 30.sp, letterSpacing = (-0.02).em), SgmColor.Green)
        WordmarkText("Ve", SgmType.DisplayXL.copy(fontSize = 24.sp), Sgm.colors.textPrimary)
    }
}

@Composable
private fun WordmarkText(text: String, style: TextStyle, color: Color) {
    Text(text = text, style = style.copy(color = color), maxLines = 1)
}

@Composable
private fun HomeHeroBadge() {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(SgmColor.Green)
            .padding(horizontal = 12.dp, vertical = 3.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "PROCHAINE COURSE",
            style = SgmType.Eyebrow.copy(color = SgmColor.TextOnGreen, fontSize = 11.sp, lineHeight = 11.sp, letterSpacing = 0.14.em),
            maxLines = 1,
        )
    }
}
