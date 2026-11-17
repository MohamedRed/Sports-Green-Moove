package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.TeamConversationGateway
import be.sportgreenmoove.app.services.SharedPreferencesTeamConversationDrafts
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@Composable
internal fun TeamConversationRoute(uid: String, target: TeamConversationTarget, gateway: TeamConversationGateway, onBack: () -> Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val state = remember(uid, target, gateway, refresh) { TeamConversationState(uid, target, gateway) }
    val scope = rememberCoroutineScope(); val owner = LocalLifecycleOwner.current; val list = rememberLazyListState()
    val context = LocalContext.current
    val storage = remember(context) { SharedPreferencesTeamConversationDrafts(context) }
    val draft = remember(uid, target, storage) { TeamConversationDraftState(uid, target, storage) }
    LaunchedEffect(draft) { draft.load() }
    BackHandler(onBack = onBack)
    LaunchedEffect(state, owner, refresh) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try {
                while (currentCoroutineContext().isActive) {
                    state.refresh()
                    if (state.error != null) awaitCancellation()
                    delay(4_000)
                }
            } finally { state.clear() }
        }
    }
    val composer = draft.composer
    if (composer == null) {
        TeamConversationDraftScreen(draft.error, draft::load, onBack)
        return
    }
    fun acknowledged(requestId: String) = state.messages.any { it.mine && it.requestId == requestId }
    LaunchedEffect(composer.pendingId, state.messages) { composer.pendingId?.takeIf(::acknowledged)?.let(composer::acknowledge) }
    LaunchedEffect(state.messages.firstOrNull()?.id) { if (list.firstVisibleItemIndex <= 1) list.scrollToItem(0) }
    TeamConversationScreen(state, composer, list, onBack, onRetry = { refresh++ },
        onEarlier = { scope.launch { state.earlier() } }, onSend = { scope.launch {
            composer.sendOperation({ body, id -> gateway.send(uid, target, body, id) }, ::acknowledged)
            state.refresh()
        } })
}
