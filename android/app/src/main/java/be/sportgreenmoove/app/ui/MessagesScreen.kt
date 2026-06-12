package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import be.sportgreenmoove.app.services.FirebaseGateway

@Composable
fun MessagesScreen(firebase: FirebaseGateway) {
    var selectedTab by remember { mutableStateOf("chats") }
    var inbox by remember { mutableStateOf(InboxSummary()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(firebase) {
        loading = true
        error = null
        runCatching { firebase.getInbox() }
            .onSuccess { inbox = it }
            .onFailure { error = it.message ?: "Inbox indisponible." }
        loading = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Sgm.colors.bgApp)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 20.dp),
    ) {
        MessagesHeader()
        MessagesTabs(tabs = messageTabs(inbox), selected = selectedTab, onSelected = { selectedTab = it })
        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            when {
                loading -> MessagesEmptyCard("Synchronisation de l'inbox...")
                error != null -> MessagesEmptyCard(error.orEmpty())
                selectedTab == "notifs" -> if (inbox.notifications.isEmpty()) {
                        MessagesEmptyCard("Aucune notification.")
                    } else {
                        inbox.notifications.forEach { notice -> NotificationCard(notice) }
                    }
                selectedTab == "avis" -> if (inbox.reviews.isEmpty()) {
                        MessagesEmptyCard("Aucun avis en attente.")
                    } else {
                        inbox.reviews.forEach { review -> ReviewCard(review) }
                    }
                else -> if (inbox.chats.isEmpty()) {
                        MessagesEmptyCard("Aucune conversation.")
                    } else {
                        inbox.chats.forEach { chat -> ChatCard(chat) }
                }
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
        V2ThemeButton()
    }
}

@Composable
private fun MessagesTabs(tabs: List<MessageTab>, selected: String, onSelected: (String) -> Unit) {
    Row(
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        tabs.forEach { tab ->
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
        if (tab.count > 0) {
            Spacer(Modifier.size(4.dp))
            MessageTabBadge(tab.count.toString(), selected)
        }
    }
}

private fun messageTabs(inbox: InboxSummary) = listOf(
    MessageTab("notifs", "NOTIFS", inbox.notifications.count { it.unread }),
    MessageTab("chats", "CHATS", inbox.chats.sumOf { it.unreadCount }),
    MessageTab("avis", "AVIS", inbox.reviews.size),
)

private data class MessageTab(val id: String, val label: String, val count: Int)
