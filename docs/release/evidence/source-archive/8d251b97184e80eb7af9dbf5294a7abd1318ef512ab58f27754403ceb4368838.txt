package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType
import java.util.Locale

@Composable
fun ProfileIdentity(displayName: String?, email: String?, primaryClubLabel: String) {
    val name = displayName?.takeIf(String::isNotBlank) ?: email?.substringBefore("@") ?: "Green-Mover"
    val initials = name.split(Regex("\\s+"))
        .filter(String::isNotBlank)
        .take(2)
        .joinToString("") { it.first().uppercaseChar().toString() }
        .ifBlank { "GM" }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 16.dp, end = 20.dp, bottom = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(80.dp)
                .shadow(10.dp, CircleShape, clip = false)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(SgmColor.Green, SgmColor.GreenDark))),
            contentAlignment = Alignment.Center,
        ) {
            Text(initials, style = SgmType.Display2XL.copy(color = SgmColor.TextOnGreen, fontSize = 30.sp, letterSpacing = 0.04.em))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                name.uppercase(Locale.FRANCE),
                style = SgmType.DisplayXL.copy(color = Sgm.colors.textPrimary, fontSize = 22.sp, letterSpacing = 0.06.em),
            )
            Text(
                "$primaryClubLabel${email?.let { " · $it" }.orEmpty()}",
                style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Medium),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            ProfilePill("GREEN-MOOVER", selected = false)
            ProfilePill("U8 NATIONAUX", selected = true)
        }
    }
}

@Composable
private fun ProfilePill(text: String, selected: Boolean) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) SgmColor.Green else Sgm.colors.bgCard)
            .then(if (selected) Modifier else Modifier.border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(999.dp)))
            .padding(horizontal = 12.dp, vertical = 3.dp),
    ) {
        Text(text, style = SgmType.Label.copy(color = if (selected) SgmColor.TextOnGreen else SgmColor.Green, fontSize = 11.sp, letterSpacing = 0.04.em))
    }
}
