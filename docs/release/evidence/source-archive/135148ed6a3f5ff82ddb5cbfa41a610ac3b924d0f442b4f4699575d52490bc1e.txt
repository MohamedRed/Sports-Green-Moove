package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SearchMatchCard(
    match: TripMatchSummary, sending: Boolean, confirmed: Boolean, retry: Boolean,
    requestEnabled: Boolean, onRequest: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.LG))
        .background(Sgm.colors.bgCard).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
        .padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(match.summary.sport.uppercase(), style = SgmType.BodyXS.copy(color = SgmColor.Green, fontWeight = FontWeight.Bold),
                modifier = Modifier.weight(1f))
            Text(match.summary.departureLabel, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted), modifier = Modifier.weight(1f))
        }
        Text(match.summary.title, style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 17.sp),
            maxLines = 2, overflow = TextOverflow.Ellipsis)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val meta = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text(match.summary.seatsLabel, style = meta)
            Text(match.summary.priceLabel, style = meta)
            match.detourMinutes?.let { Text("+$it min détour", style = meta) }
        }
        Text(match.reasons.take(3).joinToString(" · "), style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted),
            maxLines = 2, overflow = TextOverflow.Ellipsis)
        Box(Modifier.fillMaxWidth().heightIn(min = 36.dp).semantics { liveRegion = LiveRegionMode.Polite },
            contentAlignment = Alignment.Center) {
            if (confirmed) Text("Demande envoyée.", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary),
                modifier = Modifier.testTag(SgmTestTags.BookingRequestConfirmed))
            else V2Button(if (sending) "Envoi en cours" else if (retry) "Réessayer" else "Demander",
                onClick = onRequest, size = V2ButtonSize.Sm, full = true,
                enabled = requestEnabled && !sending, testTag = SgmTestTags.BookingRequestAction)
        }
    }
}
