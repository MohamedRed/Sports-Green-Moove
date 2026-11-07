package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.GuardianVerificationGateway
import kotlinx.coroutines.launch

@Composable
internal fun GuardianVerificationRoute(uid: String, gateway: GuardianVerificationGateway, onBack: () -> Unit) {
    val state = remember(uid, gateway) { GuardianVerificationState(uid, gateway) }
    val scope = rememberCoroutineScope()
    val owner = LocalLifecycleOwner.current
    var picker by remember(state) { mutableStateOf<GuardianOptionKind?>(null) }
    var confirmation by remember(state) { mutableStateOf<Pair<GuardianVerification, GuardianParentAction>?>(null) }
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner) { owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { state.refresh() } }
    LaunchedEffect(state.view) { confirmation = null }
    GuardianVerificationScreen(state, onBack,
        onRefresh = { confirmation = null; scope.launch { state.refresh() } },
        onPick = { picker = it }, onReview = { scope.launch { state.reviewSelection() } },
        onHistory = { scope.launch { state.reviewHistory(it) } }, onMoreHistory = { scope.launch { state.history.more() } },
        onAction = { view, action -> confirmation = view to action })
    picker?.let { kind ->
        val page = if (kind == GuardianOptionKind.Children) state.children else state.clubs
        GuardianOptionDialog(kind, page, if (kind == GuardianOptionKind.Children) state.childId else state.clubId,
            onChoose = { id -> if (kind == GuardianOptionKind.Children) state.selectChild(id) else state.selectClub(id); picker = null },
            onMore = { scope.launch { page.more() } }, onRetry = { scope.launch { page.reload() } }, onClose = { picker = null })
    }
    confirmation?.let { (view, action) ->
        GuardianParentConfirmation(view, action, onClose = { confirmation = null }, onConfirm = {
            confirmation = null; scope.launch { state.submit(view, action) }
        })
    }
}
