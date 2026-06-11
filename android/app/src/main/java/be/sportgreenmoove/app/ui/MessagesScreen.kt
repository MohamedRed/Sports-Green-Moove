package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

private val MessageTabs = listOf(
    MessageTab("notifs", "NOTIFS", "1"),
    MessageTab("chats", "CHATS", "3"),
    MessageTab("avis", "AVIS", "1"),
)

private val ChatRows = listOf(
    ChatPreview("IB", "Idriss BAMAKO", "parfait on fait comme ça !", "29-10-2022", 2),
    ChatPreview("NT", "Nadège TOUSSAINT", "Il finit l'étude à 16h45, ça ira !", "02-11-2022", 1),
    ChatPreview("NC", "Nino CASTELUC CI", "Merci Olivier, mon enfant est confirmé.", "05-11-2022", 0),
)

private val NotificationRows = listOf(
    MessageNotice("NT", "30-10-2022", "Vous avez un nouveau message de Nadège TOUSSAINT", true),
    MessageNotice("IB", "14-11-2022", "Comment s'est passé votre voyage avec Idriss BAMAKO? Donnez-nous votre avis.", false),
)

private val ReviewRows = listOf(
    ReviewRequest("IB", "Idriss BAMAKO", "Comment s'est passé votre voyage avec Idriss BAMAKO, papa de Moussa U8 Nationaux?"),
)

@Composable
fun MessagesScreen() {
    var selectedTab by remember { mutableStateOf("chats") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Sgm.colors.bgApp)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 20.dp),
    ) {
        MessagesHeader()
        MessagesTabs(selected = selectedTab, onSelected = { selectedTab = it })
        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            when (selectedTab) {
                "notifs" -> NotificationRows.forEach { notice -> NotificationCard(notice) }
                "avis" -> ReviewRows.forEach { review -> ReviewCard(review) }
                else -> ChatRows.forEach { chat -> ChatCard(chat) }
            }
        }
    }
}

@Composable
private fun MessagesHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 34.dp, end = 20.dp, bottom = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            "MESSAGES",
            style = SgmType.DisplayXL.copy(color = Sgm.colors.textPrimary, fontSize = 22.sp, letterSpacing = 0.08.em),
            modifier = Modifier.weight(1f),
        )
        MessageCircleIconButton(icon = SgmIcon.Moon)
    }
}

@Composable
private fun MessagesTabs(selected: String, onSelected: (String) -> Unit) {
    Row(
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        MessageTabs.forEach { tab ->
            MessageTabButton(
                tab = tab,
                selected = selected == tab.id,
                onClick = { onSelected(tab.id) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MessageTabButton(tab: MessageTab, selected: Boolean, onClick: () -> Unit, modifier: Modifier) {
    Row(
        modifier = modifier
            .height(34.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) SgmColor.Green else Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(999.dp))
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Text(
            tab.label,
            style = SgmType.Label.copy(
                color = if (selected) SgmColor.TextOnGreen else Sgm.colors.textMuted,
                fontSize = 10.sp,
                letterSpacing = 0.06.em,
            ),
        )
        Spacer(Modifier.size(4.dp))
        MessageTabBadge(tab.badge, selected)
    }
}

@Composable
private fun ChatCard(chat: ChatPreview) {
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
            Text(chat.name, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold), maxLines = 1)
            Text(
                chat.preview,
                style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(chat.date, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 10.sp, fontWeight = FontWeight.Medium))
            if (chat.unread > 0) {
                MessageUnreadBadge(chat.unread.toString())
            }
        }
    }
}

@Composable
private fun NotificationCard(notice: MessageNotice) {
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
            Text(
                notice.date,
                style = SgmType.BodyXS.copy(
                    color = if (notice.unread) SgmColor.Green else Sgm.colors.textMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.04.em,
                ),
            )
            Text(
                notice.message,
                style = SgmType.BodySM.copy(
                    color = Sgm.colors.textPrimary,
                    fontWeight = if (notice.unread) FontWeight.SemiBold else FontWeight.Normal,
                ),
            )
        }
        if (notice.unread) {
            Box(
                modifier = Modifier
                    .padding(top = 4.dp)
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(SgmColor.Green),
            )
        }
    }
}

@Composable
private fun ReviewCard(review: ReviewRequest) {
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
            Text(review.name, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold))
        }
        Text(review.question, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(5) {
                Text("★", style = SgmType.DisplayXL.copy(color = SgmColor.Orange, fontSize = 26.sp))
            }
        }
    }
}

@Composable
private fun MessageCircleIconButton(icon: SgmIcon) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        SgmLineIcon(icon = icon, tint = Sgm.colors.textSecondary, modifier = Modifier.size(16.dp))
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
private fun MessageTabBadge(text: String, selected: Boolean) {
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
private data class MessageTab(val id: String, val label: String, val badge: String)
private data class ChatPreview(val initials: String, val name: String, val preview: String, val date: String, val unread: Int)
private data class MessageNotice(val initials: String, val date: String, val message: String, val unread: Boolean)
private data class ReviewRequest(val initials: String, val name: String, val question: String)
