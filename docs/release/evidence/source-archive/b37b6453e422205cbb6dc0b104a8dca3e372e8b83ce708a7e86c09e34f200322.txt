package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.data.ConversationContext
import be.sportgreenmoove.app.services.ConversationGateway
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

@Composable
fun ConversationRoute(ref: ConversationRef, gateway: ConversationGateway, context: ConversationContext? = null, onBack: () -> Unit) {
    val state = remember(ref, gateway) { ConversationState(ref, gateway) }
    val scope = rememberCoroutineScope()
    val owner = LocalLifecycleOwner.current
    val listState = rememberLazyListState()
    var refresh by remember { mutableIntStateOf(0) }
    val draftState = rememberSaveable(ref.key) { mutableStateOf("") }
    val pendingState = rememberSaveable(ref.key) { mutableStateOf<String?>(null) }
    val composer = remember(draftState, pendingState) { ConversationComposerState(draftState, pendingState) }

    BackHandler(onBack = onBack)
    LaunchedEffect(state, owner, refresh) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { state.observe() }
    }
    LaunchedEffect(state, listState, owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            snapshotFlow {
                val visible = listState.layoutInfo.visibleItemsInfo.mapNotNull { it.key as? String }
                state.messages.filter { it.needsRead && it.id in visible }.map { it.id }
            }.distinctUntilChanged().collect { state.markVisibleRead(it) }
        }
    }
    LaunchedEffect(state.messages.firstOrNull()?.id) {
        if (listState.firstVisibleItemIndex <= 1) listState.scrollToItem(0)
    }
    fun acknowledged(id: String) = state.messages.any { it.mine && it.requestId == id }
    LaunchedEffect(composer.pendingId, state.messages) {
        composer.pendingId?.takeIf(::acknowledged)?.let(composer::acknowledge)
    }
    ConversationScreen(state = state, context = context, listState = listState, draft = composer.draft,
        onDraft = composer::edit, draftLocked = composer.locked,
        sending = composer.sending, sendError = composer.error,
        onSend = { scope.launch { composer.send(ref, gateway, ::acknowledged) } }, onBack = onBack,
        onRetry = { refresh += 1 }, onEarlier = { scope.launch { state.loadEarlier() } },
        onRetryRead = { scope.launch { state.markVisibleRead(listState.layoutInfo.visibleItemsInfo.mapNotNull { it.key as? String }) } })
}
