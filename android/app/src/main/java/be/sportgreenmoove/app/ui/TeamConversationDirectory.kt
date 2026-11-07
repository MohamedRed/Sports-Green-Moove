package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.TeamChatChoice
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.TeamConversationGateway
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch

@Composable
internal fun TeamConversationArea(uid: String, gateway: TeamConversationGateway, onBack: () -> Unit) {
    var clubId by rememberSaveable(uid) { mutableStateOf<String?>(null) }
    var teamId by rememberSaveable(uid) { mutableStateOf<String?>(null) }
    var instance by rememberSaveable(uid) { mutableStateOf<String?>(null) }
    val saved = rememberSaveableStateHolder()
    val target = teamId?.let { id -> instance?.let { TeamConversationTarget(id, it) } }
    if (target != null) saved.SaveableStateProvider("$uid:${target.key}") {
        TeamConversationRoute(uid, target, gateway) { teamId = null; instance = null }
    } else TeamConversationDirectory(uid, gateway, clubId, onBack = { if (clubId != null) clubId = null else onBack() }) { choice ->
        if (clubId == null) clubId = choice.id
        else { teamId = choice.id; instance = requireNotNull(choice.teamInstanceId) }
    }
}

@Composable
private fun TeamConversationDirectory(uid: String, gateway: TeamConversationGateway, clubId: String?, onBack: () -> Unit,
    onOpen: (TeamChatChoice) -> Unit) {
    fun newPage() = GuardianPageState({ cursor -> gateway.choices(uid, clubId, cursor) }, TeamChatChoice::id)
    var page by remember(uid, gateway, clubId) { mutableStateOf(newPage()) }
    var refresh by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope(); val owner = LocalLifecycleOwner.current
    BackHandler(onBack = onBack)
    LaunchedEffect(uid, gateway, clubId, owner, refresh) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            val current = newPage(); page = current
            try { current.reload(); awaitCancellation() } finally { current.close() }
        }
    }
    Column(Modifier.fillMaxSize().background(Sgm.colors.bgApp).sgmTestTag("team-chat.directory")) {
        V2TopBar(if (clubId == null) "CLUBS" else "ÉQUIPES", onBack = onBack, trailing = {
            V2CircleIconButton(SgmIcon.Refresh, { refresh++ }, size = 44, description = "Actualiser les équipes", testTag = "team-chat.directory-refresh")
        })
        LazyColumn(Modifier.weight(1f).sgmTestTag("team-chat.choices"), contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (page.busy) item { Text("Chargement...", color = Sgm.colors.textSecondary) }
            page.error?.let { error -> item {
                Text(error, color = Sgm.colors.textPrimary)
                V2Button("Actualiser", { refresh++ }, testTag = "team-chat.directory-retry")
            } }
            if (page.loaded && page.items.isEmpty() && !page.hasMore) item {
                Text(if (clubId == null) "Aucun club disponible." else "Aucune équipe approuvée.", color = Sgm.colors.textSecondary)
            }
            items(page.items, key = { it.id }) { choice ->
                Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).sgmTestTag("team-chat.choice.${choice.id}")
                    .clickable(enabled = choice.name != null && !page.busy) { onOpen(choice) }.padding(vertical = 12.dp)) {
                    Text(choice.name ?: "Nom indisponible", style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary), modifier = Modifier.weight(1f))
                    choice.unreadCount?.takeIf { it > 0 }?.let { count ->
                        Text(if (count > 99) "99+ non lus" else if (count == 1L) "1 non lu" else "$count non lus",
                            style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary),
                            modifier = Modifier.padding(horizontal = 8.dp).sgmTestTag("team-chat.unread.${choice.id}"))
                    }
                    SgmLineIcon(SgmIcon.ChevronRight, tint = Sgm.colors.textSecondary, modifier = Modifier.size(24.dp))
                }
            }
            if (page.hasMore) item {
                TextButton(onClick = { scope.launch { page.more() } }, enabled = !page.busy,
                    modifier = Modifier.sgmTestTag("team-chat.choices-more")) { Text("Autres choix") }
            }
        }
    }
}
