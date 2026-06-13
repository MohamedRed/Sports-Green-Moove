package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun PublishPlaceField(
    label: String,
    icon: SgmIcon,
    value: String,
    selected: ResolvedPlace?,
    suggestions: List<PlaceSuggestion>,
    onValueChange: (String) -> Unit,
    onSuggest: (String) -> Unit,
    onSelect: (PlaceSuggestion) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PublishAddressInput(icon, label, value, onValueChange, Modifier.weight(1f))
            V2Button("Chercher", onClick = { onSuggest(value) }, size = V2ButtonSize.Sm, variant = V2ButtonVariant.Secondary)
        }
        selected?.let {
            Text(
                it.formattedAddress,
                style = SgmType.BodyXS.copy(color = SgmColor.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        suggestions.take(4).forEach { suggestion ->
            PublishSuggestionRow(suggestion = suggestion) { onSelect(suggestion) }
        }
    }
}

@Composable
private fun PublishAddressInput(
    icon: SgmIcon,
    placeholder: String,
    value: String,
    onValue: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .height(46.dp)
            .clip(RoundedCornerShape(SgmRadius.MD))
            .background(Sgm.colors.bgInput)
            .border(BorderStroke(1.5.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD))
            .padding(horizontal = 14.dp),
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
private fun PublishSuggestionRow(suggestion: PlaceSuggestion, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SgmLineIcon(SgmIcon.Location, tint = SgmColor.Green, modifier = Modifier.size(16.dp))
        Column(Modifier.weight(1f)) {
            Text(suggestion.mainText ?: suggestion.label, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
            suggestion.secondaryText?.let {
                Text(it, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
