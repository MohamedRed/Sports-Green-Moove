package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.design.*

@Composable
fun ReviewCard(review: InboxReviewPrompt, submitting: Boolean, onRate: (Int) -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().sgmTestTag(SgmTestTags.RatingPromptAction)
            .clip(RoundedCornerShape(SgmRadius.LG)).background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG)).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MessageAvatar(review.initials, size = 36)
            Text(review.title, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold), modifier = Modifier.weight(1f))
        }
        val trip = review.tripContext
        if (trip == null) {
            Text("Détails du trajet indisponibles", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary),
                modifier = Modifier.sgmTestTag("review.trip.unavailable"))
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(trip.title, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.SemiBold),
                    modifier = Modifier.sgmTestTag("review.trip.title"))
                Text(trip.departureLabel, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary),
                    modifier = Modifier.sgmTestTag("review.trip.departure"))
            }
        }
        Text(review.prompt, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        Text(if (submitting) "Envoi de l'avis..." else "Touchez une note.",
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold))
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(5) { index ->
                Text("★", style = SgmType.DisplayXL.copy(color = SgmColor.Orange, fontSize = 26.sp),
                    modifier = Modifier.sgmTestTag("${SgmTestTags.RatingPromptAction}.${index + 1}")
                        .clickable(enabled = !submitting) { onRate(index + 1) })
            }
        }
    }
}
