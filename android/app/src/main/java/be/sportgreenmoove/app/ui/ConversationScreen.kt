package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import kotlinx.coroutines.launch

@Composable
internal fun ConversationScreen(
    state: ConversationState, listState: LazyListState, draft: String, onDraft: (String) -> Unit,
    draftLocked: Boolean, sending: Boolean, sendError: String?, onSend: () -> Unit, onBack: () -> Unit,
    onRetry: () -> Unit, onEarlier: () -> Unit, onRetryRead: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().sgmTestTag(SgmTestTags.ChatThreadScreen).background(Sgm.colors.bgApp).imePadding()) {
        V2TopBar("CONVERSATION", onBack = onBack)
        if (state.error == null && state.participantNames.isNotEmpty()) Text(state.participantNames.joinToString(" · "),
            style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary), maxLines = 2, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
        when {
            state.error != null -> Column(Modifier.weight(1f).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(state.error.orEmpty(), style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
                V2Button("Réessayer", onClick = onRetry, testTag = SgmTestTags.ChatRetryAction)
            }
            else -> {
                LazyColumn(state = listState, reverseLayout = true, modifier = Modifier.weight(1f).fillMaxWidth()
                    .sgmTestTag(SgmTestTags.ChatMessageList), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(state.messages, key = { it.id }) { message -> ConversationBubble(message) }
                    if (state.loading) item { ConversationStatus("Chargement...") }
                    else if (state.messages.isEmpty()) item { ConversationStatus("Aucun message.") }
                    if (state.hasEarlier) item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                            TextButton(onClick = onEarlier, enabled = !state.loadingEarlier,
                                modifier = Modifier.sgmTestTag(SgmTestTags.ChatLoadEarlierAction)) {
                                Text(if (state.loadingEarlier) "Chargement..." else "Messages précédents")
                            }
                        }
                    }
                    state.earlierError?.let { error -> item { ConversationStatus(error) } }
                }
                if (listState.firstVisibleItemIndex > 1) TextButton(
                    onClick = { scope.launch { listState.animateScrollToItem(0) } }, modifier = Modifier.align(Alignment.CenterHorizontally),
                ) { Text("Derniers messages") }
                state.readError?.let { error ->
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(error, modifier = Modifier.weight(1f), style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary))
                        TextButton(onClick = onRetryRead, modifier = Modifier.sgmTestTag(SgmTestTags.ChatReadRetryAction)) { Text("Réessayer") }
                    }
                }
                ConversationComposer(draft = draft, onDraft = onDraft, locked = draftLocked, sending = sending,
                    enabled = !state.loading, error = sendError, onSend = onSend)
            }
        }
    }
}

@Composable
private fun ConversationStatus(text: String) {
    Text(text, modifier = Modifier.padding(20.dp), style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
}

