package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun BookingRequestsList(
    requests: List<BookingRequestSummary>,
    onApprove: (BookingRequestSummary) -> Unit,
) {
    if (requests.isEmpty()) {
        Text(
            "Aucune demande conducteur en attente.",
            style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(SgmRadius.LG))
                .background(Sgm.colors.bgCard)
                .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
                .padding(16.dp),
        )
        return
    }

    requests.forEach { request ->
        BookingRequestCard(request = request, onApprove = { onApprove(request) })
    }
}

@Composable
private fun BookingRequestCard(request: BookingRequestSummary, onApprove: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                request.status.uppercase(),
                style = SgmType.Eyebrow.copy(color = SgmColor.Green, fontSize = 11.sp, letterSpacing = 0.14.em),
                modifier = Modifier.weight(1f),
            )
            Text(
                "${request.dateLabel} · ${request.timeLabel}",
                style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
            )
        }
        Text(
            request.title,
            style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 17.sp, letterSpacing = 0.03.em),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            "${request.seats} place${if (request.seats > 1) "s" else ""} · ${request.priceLabel} · Parent ${request.parentUserId.takeLast(6)}",
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        request.note?.takeIf(String::isNotBlank)?.let {
            Text(it, style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 12.sp), maxLines = 2)
        }
        if (request.status == "requested") {
            V2Button("APPROUVER", onClick = onApprove, size = V2ButtonSize.Sm)
        }
    }
}
