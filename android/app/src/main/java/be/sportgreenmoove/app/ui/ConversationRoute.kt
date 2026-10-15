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
import be.sportgreenmoove.app.services.MessageSendException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun ConversationRoute(ref: ConversationRef, gateway: ConversationGateway, context: ConversationContext? = null, onBack: () -> Unit) {
    val state = remember(ref, gateway) { ConversationState(ref, gateway) }
    val scope = rememberCoroutineScope()
    val owner = LocalLifecycleOwner.current
    val listState = rememberLazyListState()
    var refresh by remember { mutableIntStateOf(0) }
    var draft by rememberSaveable(ref.key) { mutableStateOf("") }
    var pendingId by rememberSaveable(ref.key) { mutableStateOf<String?>(null) }
    var sending by remember { mutableStateOf(false) }
    var sendError by remember { mutableStateOf<String?>(null) }

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
    LaunchedEffect(pendingId, state.messages) {
        pendingId?.takeIf(::acknowledged)?.let { pendingId = null; draft = ""; sendError = null }
    }
    fun send() {
        val body = draft.trim()
        if (sending || body.isBlank() || body.length > 1000) return
        val requestId = pendingId ?: UUID.randomUUID().toString()
        pendingId = requestId
        sending = true
        sendError = null
        scope.launch {
            try {
                gateway.sendMessage(ref, body, requestId)
                draft = ""
                pendingId = null
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) {
                when {
                    acknowledged(requestId) -> { draft = ""; pendingId = null }
                    failure is MessageSendException && failure.definitelyRejected -> {
                        pendingId = null
                        sendError = "Envoi refusé. Vérifiez le message et réessayez."
                    }
                    else -> sendError = "Envoi non confirmé. Réessayez."
                }
            } finally { sending = false }
        }
    }
    ConversationScreen(state = state, context = context, listState = listState, draft = draft,
        onDraft = { draft = it; sendError = null }, draftLocked = pendingId != null,
        sending = sending, sendError = sendError, onSend = ::send, onBack = onBack,
        onRetry = { refresh += 1 }, onEarlier = { scope.launch { state.loadEarlier() } },
        onRetryRead = { scope.launch { state.markVisibleRead(listState.layoutInfo.visibleItemsInfo.mapNotNull { it.key as? String }) } })
}
