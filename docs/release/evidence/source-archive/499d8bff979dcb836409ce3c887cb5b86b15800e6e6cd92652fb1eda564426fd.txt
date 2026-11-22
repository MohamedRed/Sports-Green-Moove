package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun TeamConversationScreen(state: TeamConversationState, composer: ConversationComposerState, list: LazyListState,
    onBack: () -> Unit, onRetry: () -> Unit, onRetryRead: () -> Unit, onEarlier: () -> Unit, onSend: () -> Unit) {
    Column(Modifier.fillMaxSize().background(Sgm.colors.bgApp).imePadding().sgmTestTag("team-chat.thread")) {
        V2TopBar("ÉQUIPE", onBack = onBack, trailing = {
            V2CircleIconButton(SgmIcon.Refresh, onRetry, size = 44, testTag = "team-chat.refresh", description = "Actualiser la conversation")
        })
        state.title?.takeIf { state.error == null }?.let { title ->
            Text(title, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary), modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp))
        }
        if (state.error != null) Column(Modifier.weight(1f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(state.error.orEmpty(), style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
            composer.error?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary)) }
            V2Button("Actualiser", onClick = onRetry, testTag = "team-chat.retry")
        } else {
            LazyColumn(state = list, reverseLayout = true, modifier = Modifier.weight(1f).fillMaxWidth().sgmTestTag("team-chat.messages"),
                verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(state.messages, key = { it.id }) { ConversationBubble(it) }
                if (state.loading || state.messages.isEmpty()) item {
                    Text(if (state.loading) "Chargement..." else "Aucun message.",
                        style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary), modifier = Modifier.padding(20.dp))
                }
                if (state.hasEarlier) item {
                    TextButton(onClick = onEarlier, enabled = !state.loadingEarlier, modifier = Modifier.sgmTestTag("team-chat.earlier")) {
                        Text(if (state.loadingEarlier) "Chargement..." else "Messages précédents")
                    }
                }
            }
            state.readError?.let { error ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Text(error, modifier = Modifier.weight(1f), style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary))
                    TextButton(onClick = onRetryRead, modifier = Modifier.sgmTestTag("team-chat.read-retry")) { Text("Réessayer") }
                }
            }
            ConversationComposer(composer.draft, composer::edit, composer.locked, composer.sending,
                enabled = !state.loading, error = composer.error, onSend = onSend)
        }
    }
}
