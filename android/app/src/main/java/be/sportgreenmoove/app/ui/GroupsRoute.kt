package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.launch

@Composable
fun GroupsRoute(
    sessionUid: String,
    providers: AndroidProviderSet,
    onBack: () -> Unit,
    onClubsLoaded: (List<ClubSummary>) -> Unit,
) {
    val state = remember(sessionUid, providers) {
        GroupsState(providers.firebase::listClubSummaries, providers.firebase::requestClubMembership, onClubsLoaded)
    }
    val scope = rememberCoroutineScope()
    val owner = LocalLifecycleOwner.current
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner) { owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { state.reload() } }
    GroupsScreen(
        clubs = state.clubs,
        onBack = onBack,
        loading = state.loading,
        error = state.error,
        notice = state.notice,
        onDismissNotice = state::dismissNotice,
        onRefresh = { scope.launch { state.reload() } },
        onJoinClub = { club -> scope.launch { state.join(club.id) } },
    )
}
