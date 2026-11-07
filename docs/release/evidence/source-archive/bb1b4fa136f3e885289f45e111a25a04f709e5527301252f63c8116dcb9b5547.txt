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
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import be.sportgreenmoove.app.data.ConversationListItem
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType

@Composable
fun ChatCard(chat: ConversationListItem, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .sgmTestTag(SgmTestTags.ChatOpenAction)
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        MessageAvatar(chat.title.take(2), size = 40)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(chat.title, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(chat.tripLabel, style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary), maxLines = 1, overflow = TextOverflow.Ellipsis)
            chat.peerLabel?.let { Text(it, style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary), maxLines = 1, overflow = TextOverflow.Ellipsis) }
            chat.childLabel?.let { Text(it, style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary), maxLines = 1, overflow = TextOverflow.Ellipsis) }
            Text(
                chat.preview,
                style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(chat.dateLabel, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 10.sp, fontWeight = FontWeight.Medium))
            if (chat.unreadCount > 0) MessageUnreadBadge(if (chat.unreadCount > 99) "99+" else chat.unreadCount.toString(), chat.unreadCount)
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
internal fun MessageAvatar(initials: String, size: Int, muted: Boolean = false) {
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
private fun MessageUnreadBadge(text: String, fullCount: Long) {
    Box(
        modifier = Modifier
            .size(22.dp)
            .semantics { contentDescription = "$fullCount messages non lus" }
            .clip(CircleShape)
            .background(SgmColor.Green),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold))
    }
}
