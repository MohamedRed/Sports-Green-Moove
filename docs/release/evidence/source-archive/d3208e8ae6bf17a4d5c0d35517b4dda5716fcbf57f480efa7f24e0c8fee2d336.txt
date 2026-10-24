package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.InboxSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun MessagesHeader(onNew: () -> Unit) {
    Row(Modifier.padding(start = 20.dp, top = 34.dp, end = 20.dp, bottom = 16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("MESSAGES", style = SgmType.DisplayXL.copy(color = Sgm.colors.textPrimary, fontSize = 22.sp, letterSpacing = 0.08.em),
            modifier = Modifier.weight(1f))
        V2CircleIconButton(SgmIcon.Plus, onNew, size = 36, testTag = SgmTestTags.ChatNewConversationAction,
            description = "Nouvelle conversation")
        V2ThemeButton()
    }
}

@Composable
internal fun MessagesTabs(inbox: InboxSummary, selected: String, onSelected: (String) -> Unit, teamsEnabled: Boolean = false) {
    val tabs = listOf(MessageTab("notifs", "NOTIFS", inbox.notifications.count { it.unread }, null),
        MessageTab("chats", "CHATS", 0, SgmTestTags.ChatTab), MessageTab("avis", "AVIS", inbox.reviews.size, SgmTestTags.RatingTab)) +
        if (teamsEnabled) listOf(MessageTab("teams", "ÉQUIPES", 0, "team-chat.tab")) else emptyList()
    Row(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        tabs.forEach { tab -> MessageTabButton(tab, selected == tab.id, { onSelected(tab.id) }, Modifier.weight(1f)) }
    }
}

@Composable
private fun MessageTabButton(tab: MessageTab, selected: Boolean, onClick: () -> Unit, modifier: Modifier) {
    Row(modifier.sgmOptionalTestTag(tab.testTag).height(34.dp).clip(RoundedCornerShape(999.dp))
        .background(if (selected) SgmColor.Green else Sgm.colors.bgCard)
        .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(999.dp)).clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        Text(tab.label, style = SgmType.Label.copy(color = if (selected) SgmColor.TextOnGreen else Sgm.colors.textMuted,
            fontSize = 10.sp, letterSpacing = 0.06.em))
        if (tab.count > 0) { Spacer(Modifier.size(4.dp)); MessageTabBadge(tab.count.toString(), selected) }
    }
}

private data class MessageTab(val id: String, val label: String, val count: Int, val testTag: String?)
