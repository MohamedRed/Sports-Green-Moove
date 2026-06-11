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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

private val PublishCats = listOf("U 5/6", "U 7/8", "U 9/10", "U 11/12", "U 13/14", "U 15/16", "Seniors", "Réserves")
private val PublishFreqs = listOf("UNIQUE", "CHAQUE LUN", "CHAQUE MAR", "CHAQUE MER", "CHAQUE JEU", "CHAQUE VEN", "CHAQUE SAM", "CHAQUE DIM")

@Suppress("UNUSED_PARAMETER")
@Composable
fun PublishScreen(role: AppRole) {
    var step by remember { mutableStateOf(1) }
    var published by remember { mutableStateOf(false) }
    var from by remember { mutableStateOf("") }
    var to by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("U 7/8") }
    var returnTrip by remember { mutableStateOf(true) }
    var seats by remember { mutableStateOf(2) }
    var frequency by remember { mutableStateOf("UNIQUE") }
    var price by remember { mutableStateOf("") }

    if (published) {
        PublishSuccess { published = false; step = 1 }
        return
    }

    V2Screen {
        V2TopBar("PUBLIER UN TRAJET", onBack = if (step > 1) ({ step -= 1 }) else null)
        PublishStepIndicator(step)
        Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (step) {
                1 -> PublishStepOne(from, { from = it }, to, { to = it }, onNext = { step = 2 })
                2 -> PublishStepTwo(
                    category = category,
                    onCategory = { category = it },
                    returnTrip = returnTrip,
                    onReturnTrip = { returnTrip = !returnTrip },
                    seats = seats,
                    onSeats = { seats = it.coerceIn(1, 6) },
                    frequency = frequency,
                    onFrequency = { frequency = it },
                    price = price,
                    onPrice = { price = it },
                    onNext = { step = 3 },
                )

                else -> PublishStepThree(from, to, seats, frequency, returnTrip, price, category, onPublish = { published = true })
            }
        }
    }
}

@Composable
private fun PublishStepIndicator(step: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 6.dp, end = 20.dp, bottom = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        (1..3).forEach { index ->
            PublishStepDot(index, active = step >= index)
            if (index < 3) Box(Modifier.weight(1f).height(2.dp).clip(RoundedCornerShape(999.dp)).background(if (step > index) SgmColor.Green else Sgm.colors.border))
        }
    }
}

@Composable
private fun PublishStepOne(from: String, onFrom: (String) -> Unit, to: String, onTo: (String) -> Unit, onNext: () -> Unit) {
    PublishTitle("DÉPART & DESTINATION")
    PublishInput(SgmIcon.Location, "Adresse de départ", from, onFrom)
    PublishInput(SgmIcon.Flag, "Adresse de destination", to, onTo)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(110.dp)
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(SgmColor.HeroGradient),
        contentAlignment = Alignment.Center,
    ) {
        SgmGridTexture()
        Text("GREEN SMARTMAP", style = SgmType.Eyebrow.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.40f), fontSize = 14.sp, letterSpacing = 0.12.em))
    }
    V2Button("SUIVANT →", onClick = onNext, full = true, size = V2ButtonSize.Lg)
}

@Composable
private fun PublishStepTwo(
    category: String,
    onCategory: (String) -> Unit,
    returnTrip: Boolean,
    onReturnTrip: () -> Unit,
    seats: Int,
    onSeats: (Int) -> Unit,
    frequency: String,
    onFrequency: (String) -> Unit,
    price: String,
    onPrice: (String) -> Unit,
    onNext: () -> Unit,
) {
    PublishTitle("DÉTAILS DU TRAJET")
    PublishChoiceRow("Catégorie", PublishCats, category, onCategory)
    PublishToggleRow("Aller - retour", returnTrip, onReturnTrip)
    PublishSeatsRow(seats, onSeats)
    PublishChoiceRow("Fréquence", PublishFreqs, frequency, onFrequency, titleFirst = true)
    PublishPriceRow(price, onPrice)
    V2Button("SUIVANT →", onClick = onNext, full = true, size = V2ButtonSize.Lg)
}

@Composable
private fun PublishStepThree(from: String, to: String, seats: Int, frequency: String, returnTrip: Boolean, price: String, category: String, onPublish: () -> Unit) {
    PublishTitle("CONFIRMER")
    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.LG)).background(Sgm.colors.bgCard).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))) {
        Box(Modifier.fillMaxWidth().background(SgmColor.HeroGradient).padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text("FOOTBALL · $category", style = SgmType.DisplayLG.copy(color = SgmColor.TextOnGreen, fontSize = 18.sp, letterSpacing = 0.04.em))
        }
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Départ" to (from.ifBlank { "—" }), "Destination" to (to.ifBlank { "—" }), "Places" to seats.toString(), "Fréquence" to frequency, "Aller-retour" to if (returnTrip) "Oui" else "Non", "Prix" to (if (price.isNotBlank()) "$price€" else "Gratuit")).forEach { (label, value) ->
                PublishSummaryRow(label, value)
            }
        }
    }
    V2Button("PUBLIER CE TRAJET", onClick = onPublish, full = true, size = V2ButtonSize.Lg)
}

@Composable
private fun PublishInput(icon: SgmIcon, placeholder: String, value: String, onValue: (String) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.MD)).background(Sgm.colors.bgInput).border(BorderStroke(1.5.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD)).padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        SgmLineIcon(icon, tint = SgmColor.Green, modifier = Modifier.size(18.dp))
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(placeholder, style = PublishBodyStyle(Sgm.colors.textMuted))
            BasicTextField(value = value, onValueChange = onValue, textStyle = PublishBodyStyle(Sgm.colors.textPrimary), singleLine = true, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun PublishChoiceRow(label: String, values: List<String>, selected: String, onSelect: (String) -> Unit, titleFirst: Boolean = false) {
    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.MD)).background(Sgm.colors.bgSurface).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD)).padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(if (titleFirst) 8.dp else 0.dp)) {
        Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold))
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()).padding(top = if (titleFirst) 0.dp else 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            values.forEach { value -> V2Chip(value, selected = selected == value, onClick = { onSelect(value) }) }
        }
    }
}

@Composable
private fun PublishToggleRow(label: String, selected: Boolean, onClick: () -> Unit) {
    PublishControlRow(label) {
        Box(modifier = Modifier.size(width = 44.dp, height = 24.dp).clip(RoundedCornerShape(999.dp)).background(if (selected) SgmColor.Green else Sgm.colors.bgInput).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(999.dp)).clickable(onClick = onClick)) {
            Box(Modifier.padding(start = if (selected) 22.dp else 2.dp, top = 2.dp).size(18.dp).clip(CircleShape).background(SgmColor.TextOnGreen))
        }
    }
}

@Composable
private fun PublishSeatsRow(seats: Int, onSeats: (Int) -> Unit) {
    PublishControlRow("Places disponibles") {
        V2CircleIconButton(SgmIcon.ChevronLeft, onClick = { onSeats(seats - 1) }, size = 28)
        Text(seats.toString(), style = SgmType.DisplayXL.copy(color = SgmColor.Green, fontSize = 22.sp), modifier = Modifier.size(width = 24.dp, height = 28.dp), textAlign = TextAlign.Center)
        V2CircleIconButton(SgmIcon.Plus, onClick = { onSeats(seats + 1) }, size = 28)
    }
}

@Composable
private fun PublishPriceRow(price: String, onPrice: (String) -> Unit) {
    PublishControlRow("Prix estimé") {
        BasicTextField(value = price, onValueChange = onPrice, textStyle = PublishBodyStyle(Sgm.colors.textPrimary).copy(textAlign = TextAlign.End), singleLine = true, modifier = Modifier.size(width = 70.dp, height = 28.dp).clip(RoundedCornerShape(8.dp)).background(Sgm.colors.bgInput).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 6.dp))
        Text("€", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, fontSize = 14.sp, fontWeight = FontWeight.Bold))
    }
}

@Composable
private fun PublishControlRow(label: String, trailing: @Composable RowScope.() -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.MD)).background(Sgm.colors.bgSurface).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD)).padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), content = trailing)
    }
}

@Composable
private fun PublishSuccess(onDone: () -> Unit) {
    V2Screen {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 40.dp, vertical = 120.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Box(Modifier.size(80.dp).clip(CircleShape).background(SgmColor.Green), contentAlignment = Alignment.Center) { SgmLineIcon(SgmIcon.Check, tint = SgmColor.TextOnGreen, modifier = Modifier.size(40.dp)) }
            Text("TRAJET PUBLIÉ !", style = SgmType.Display2XL.copy(color = Sgm.colors.textPrimary, fontSize = 32.sp, letterSpacing = 0.06.em), textAlign = TextAlign.Center)
            Text("Votre trajet a bien été partagé avec les autres greens-moovers.", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, lineHeight = 21.sp), textAlign = TextAlign.Center)
            V2Button("VOIR MES TRAJETS", onClick = onDone, full = true, size = V2ButtonSize.Lg)
        }
    }
}

@Composable private fun PublishTitle(text: String) = Text(text, style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 20.sp, letterSpacing = 0.06.em), modifier = Modifier.padding(bottom = 4.dp))
@Composable private fun PublishStepDot(value: Int, active: Boolean) = Box(Modifier.size(28.dp).clip(CircleShape).background(if (active) SgmColor.Green else Sgm.colors.bgCard).then(if (active) Modifier else Modifier.border(BorderStroke(1.dp, Sgm.colors.border), CircleShape)), contentAlignment = Alignment.Center) { Text(value.toString(), style = SgmType.DisplayLG.copy(color = if (active) SgmColor.TextOnGreen else Sgm.colors.textMuted, fontSize = 14.sp)) }
@Composable private fun PublishSummaryRow(label: String, value: String) = Row(Modifier.fillMaxWidth()) { Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Medium), modifier = Modifier.weight(1f)); Text(value, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)) }
@Composable private fun PublishBodyStyle(color: androidx.compose.ui.graphics.Color) = SgmType.BodySM.copy(color = color, fontSize = 14.sp, fontWeight = FontWeight.Medium)
