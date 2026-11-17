package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.TeamConversationGateway
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
    val draft = rememberSaveable(uid, target.key) { mutableStateOf("") }
    val pending = rememberSaveable(uid, target.key) { mutableStateOf<String?>(null) }
    val composer = remember(draft, pending) { ConversationComposerState(draft, pending) }
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
    fun acknowledged(requestId: String) = state.messages.any { it.mine && it.requestId == requestId }
    LaunchedEffect(composer.pendingId, state.messages) { composer.pendingId?.takeIf(::acknowledged)?.let(composer::acknowledge) }
    LaunchedEffect(state.messages.firstOrNull()?.id) { if (list.firstVisibleItemIndex <= 1) list.scrollToItem(0) }
    TeamConversationScreen(state, composer, list, onBack, onRetry = { refresh++ },
        onEarlier = { scope.launch { state.earlier() } }, onSend = { scope.launch {
            composer.sendOperation({ body, id -> gateway.send(uid, target, body, id) }, ::acknowledged)
            state.refresh()
        } })
}
