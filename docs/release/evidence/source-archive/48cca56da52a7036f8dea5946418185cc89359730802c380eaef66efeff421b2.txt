package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun PublishInput(icon: SgmIcon, placeholder: String, value: String, onValue: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.MD))
            .background(Sgm.colors.bgInput)
            .border(BorderStroke(1.5.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SgmLineIcon(icon, tint = SgmColor.Green, modifier = Modifier.size(18.dp))
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(placeholder, style = PublishBodyStyle(Sgm.colors.textMuted))
            BasicTextField(value = value, onValueChange = onValue, textStyle = PublishBodyStyle(Sgm.colors.textPrimary), singleLine = true, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun PublishChoiceRow(label: String, values: List<String>, selected: String, onSelect: (String) -> Unit, titleFirst: Boolean = false) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.MD))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(if (titleFirst) 8.dp else 0.dp),
    ) {
        Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold))
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()).padding(top = if (titleFirst) 0.dp else 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            values.forEach { value -> V2Chip(value, selected = selected == value, onClick = { onSelect(value) }) }
        }
    }
}

@Composable
fun PublishToggleRow(label: String, selected: Boolean, onClick: () -> Unit) {
    PublishControlRow(label) {
        Box(
            modifier = Modifier
                .size(width = 44.dp, height = 24.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(if (selected) SgmColor.Green else Sgm.colors.bgInput)
                .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(999.dp))
                .clickable(onClick = onClick),
        ) {
            Box(Modifier.padding(start = if (selected) 22.dp else 2.dp, top = 2.dp).size(18.dp).clip(CircleShape).background(SgmColor.TextOnGreen))
        }
    }
}

@Composable
fun PublishSeatsRow(seats: Int, onSeats: (Int) -> Unit) {
    PublishControlRow("Places disponibles") {
        V2CircleIconButton(SgmIcon.ChevronLeft, onClick = { onSeats(seats - 1) }, size = 28)
        Text(seats.toString(), style = SgmType.DisplayXL.copy(color = SgmColor.Green, fontSize = 22.sp), modifier = Modifier.size(width = 24.dp, height = 28.dp), textAlign = TextAlign.Center)
        V2CircleIconButton(SgmIcon.Plus, onClick = { onSeats(seats + 1) }, size = 28)
    }
}

@Composable
fun PublishPriceRow(price: String, onPrice: (String) -> Unit) {
    PublishControlRow("Prix estimé") {
        BasicTextField(value = price, onValueChange = onPrice, textStyle = PublishBodyStyle(Sgm.colors.textPrimary).copy(textAlign = TextAlign.End), singleLine = true, modifier = Modifier.size(width = 70.dp, height = 28.dp).clip(RoundedCornerShape(8.dp)).background(Sgm.colors.bgInput).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 6.dp))
        Text("€", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, fontSize = 14.sp, fontWeight = FontWeight.Bold))
    }
}

@Composable
fun PublishDriverRequired() {
    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.LG)).background(Sgm.colors.bgCard).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG)).padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("MODE CONDUCTEUR REQUIS", style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 20.sp, letterSpacing = 0.06.em))
        Text("Passez en rôle conducteur depuis le profil pour publier un trajet vérifié.", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, lineHeight = 20.sp))
    }
}

@Composable
fun PublishTitle(text: String) = Text(text, style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 20.sp, letterSpacing = 0.06.em), modifier = Modifier.padding(bottom = 4.dp))

@Composable
fun PublishStepDot(value: Int, active: Boolean) {
    Box(Modifier.size(28.dp).clip(CircleShape).background(if (active) SgmColor.Green else Sgm.colors.bgCard).then(if (active) Modifier else Modifier.border(BorderStroke(1.dp, Sgm.colors.border), CircleShape)), contentAlignment = Alignment.Center) {
        Text(value.toString(), style = SgmType.DisplayLG.copy(color = if (active) SgmColor.TextOnGreen else Sgm.colors.textMuted, fontSize = 14.sp))
    }
}

@Composable
fun PublishSummaryRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Medium), modifier = Modifier.weight(1f))
        Text(value, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold))
    }
}

@Composable
fun PublishBodyStyle(color: Color) = SgmType.BodySM.copy(color = color, fontSize = 14.sp, fontWeight = FontWeight.Medium)

@Composable
private fun PublishControlRow(label: String, trailing: @Composable RowScope.() -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.MD))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), content = trailing)
    }
}
