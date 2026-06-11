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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

private val SearchSports = listOf("Tous", "Football", "Tennis", "Natation", "Cyclisme")
private val SearchResults = listOf(
    SearchResult(1, "Football", "U8 NATIONAUX VS ROYAL OTTIGNIES SC", "Wavre", "Ottignies", "MAR 07 NOV · 16h45", 2, "2.50€", "IB", "Idriss B."),
    SearchResult(2, "Football", "ENTRAÎNEMENT U8 — GROUPE B", "Wavre", "Biéreau", "JEU 10 NOV · 18h00", 1, "Gratuit", "NT", "Nadège T."),
    SearchResult(3, "Tennis", "MATCH SIMPLE — CATÉGORIE B", "Louvain-la-Neuve", "Wavre", "SAM 12 NOV · 09h00", 3, "1.80€", "NC", "Nino C."),
    SearchResult(4, "Natation", "ENTRAÎNEMENT U12 — BASSIN A", "Ottignies", "Louvain-la-Neuve", "MER 15 NOV · 17h30", 2, "2.00€", "KT", "Kévin T."),
)

@Suppress("UNUSED_PARAMETER")
@Composable
fun SearchScreen(trips: List<TripSummary>, onBack: () -> Unit) {
    var query by remember { mutableStateOf("") }
    var sport by remember { mutableStateOf("Tous") }
    var requested by remember { mutableStateOf(setOf<Int>()) }
    val results = SearchResults.filter {
        (sport == "Tous" || it.sport == sport) &&
            (query.isBlank() || "${it.event} ${it.from} ${it.to}".contains(query, ignoreCase = true))
    }

    V2Screen {
        V2TopBar("RECHERCHE")
        SearchInput(value = query, onValueChange = { query = it })
        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(start = 20.dp, end = 20.dp, bottom = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            SearchSports.forEach { option -> V2Chip(option, selected = sport == option, onClick = { sport = option }) }
        }
        Text(
            "${results.size} trajet${if (results.size > 1) "s" else ""} disponible${if (results.size > 1) "s" else ""}",
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 10.dp),
        )
        Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            results.forEach { result ->
                SearchResultCard(
                    result = result,
                    requested = result.id in requested,
                    onRequest = { requested = requested + result.id },
                )
            }
            if (results.isEmpty()) {
                Text(
                    "Aucun trajet trouvé pour cette recherche.",
                    style = SgmType.BodySM.copy(color = Sgm.colors.textMuted),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                )
            }
        }
    }
}

@Composable
private fun SearchInput(value: String, onValueChange: (String) -> Unit) {
    Row(
        modifier = Modifier
            .padding(start = 20.dp, top = 4.dp, end = 20.dp, bottom = 12.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.MD))
            .background(Sgm.colors.bgInput)
            .border(BorderStroke(1.5.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD))
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SgmLineIcon(SgmIcon.Search, tint = Sgm.colors.textMuted, modifier = Modifier.size(17.dp))
        Box(modifier = Modifier.weight(1f)) {
            if (value.isEmpty()) Text("Destination, club, événement…", style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 14.sp, fontWeight = FontWeight.Medium))
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun SearchResultCard(result: SearchResult, requested: Boolean, onRequest: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(result.sport.uppercase(), style = SgmType.Eyebrow.copy(color = SgmColor.Green, fontSize = 11.sp, letterSpacing = 0.14.em), modifier = Modifier.weight(1f))
            Text(result.date, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold))
        }
        Text(result.event, style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 17.sp, letterSpacing = 0.03.em), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp, bottom = 8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(result.from, style = SearchMetaStyle())
            SgmLineIcon(SgmIcon.ArrowRight, tint = SgmColor.Green, modifier = Modifier.size(14.dp))
            Text(result.to, style = SearchMetaStyle())
            Spacer(Modifier.weight(1f))
            Text("${result.seats} place${if (result.seats > 1) "s" else ""}", style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold))
        }
        Row(modifier = Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            V2Avatar(result.driver, size = 32)
            Column(modifier = Modifier.weight(1f)) {
                Text(result.driverName, style = SgmType.BodyXS.copy(color = Sgm.colors.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold))
                Text(result.price, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium))
            }
            if (requested) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    SgmLineIcon(SgmIcon.Check, tint = SgmColor.Green, modifier = Modifier.size(14.dp))
                    Text("Demandé", style = SgmType.BodyXS.copy(color = SgmColor.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold))
                }
            } else {
                V2Button("Demander", onClick = onRequest, size = V2ButtonSize.Sm)
            }
        }
    }
}

@Composable
private fun SearchMetaStyle() = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
private data class SearchResult(val id: Int, val sport: String, val event: String, val from: String, val to: String, val date: String, val seats: Int, val price: String, val driver: String, val driverName: String)
