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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import be.sportgreenmoove.app.data.InboxChatSummary
import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun ChatCard(chat: InboxChatSummary) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        MessageAvatar(chat.initials, size = 40)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(chat.title, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold), maxLines = 1)
            Text(
                chat.preview,
                style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(chat.dateLabel, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 10.sp, fontWeight = FontWeight.Medium))
            if (chat.unreadCount > 0) MessageUnreadBadge(chat.unreadCount.toString())
        }
    }
}

@Composable
fun NotificationCard(notice: InboxNotificationSummary) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        MessageAvatar(notice.initials, size = 36, muted = !notice.unread)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(notice.title, style = SgmType.BodyXS.copy(color = if (notice.unread) SgmColor.Green else Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.04.em))
            Text(notice.body, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontWeight = if (notice.unread) FontWeight.SemiBold else FontWeight.Normal))
            Text(notice.dateLabel, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 10.sp, fontWeight = FontWeight.Medium))
        }
        if (notice.unread) {
            Box(Modifier.padding(top = 4.dp).size(8.dp).clip(CircleShape).background(SgmColor.Green))
        }
    }
}

@Composable
fun ReviewCard(review: InboxReviewPrompt, submitting: Boolean, onRate: (Int) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MessageAvatar(review.initials, size = 36)
            Text(review.title, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold))
        }
        Text(review.prompt, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        Text(
            if (submitting) "Envoi de l'avis..." else "Touchez une note.",
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(5) { index ->
                Text(
                    "★",
                    style = SgmType.DisplayXL.copy(color = SgmColor.Orange, fontSize = 26.sp),
                    modifier = Modifier.clickable(enabled = !submitting) { onRate(index + 1) },
                )
            }
        }
    }
}

@Composable
fun MessagesEmptyCard(message: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(14.dp))
            .padding(14.dp),
    ) {
        Text(message, style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold))
    }
}

@Composable
private fun MessageAvatar(initials: String, size: Int, muted: Boolean = false) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(if (muted) Sgm.colors.bgElevated else SgmColor.Green),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials.take(2).uppercase(), style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold))
    }
}

@Composable
fun MessageTabBadge(text: String, selected: Boolean) {
    Box(
        modifier = Modifier
            .size(16.dp)
            .clip(CircleShape)
            .background(if (selected) SgmColor.TextOnGreen.copy(alpha = 0.30f) else SgmColor.Orange),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen, fontSize = 9.sp, fontWeight = FontWeight.Bold))
    }
}

@Composable
private fun MessageUnreadBadge(text: String) {
    Box(
        modifier = Modifier
            .size(18.dp)
            .clip(CircleShape)
            .background(SgmColor.Green),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold))
    }
}
