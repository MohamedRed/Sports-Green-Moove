package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.services.ProfileCityGateway
import kotlinx.coroutines.launch

@Composable
internal fun ProfileCityHost(uid: String, gateway: ProfileCityGateway,
    content: @Composable (String, () -> Unit) -> Unit) {
    key(uid, gateway) {
        val state = remember { ProfileCityState(uid, gateway) }
        val scope = rememberCoroutineScope()
        val owner = LocalLifecycleOwner.current
        var editing by remember { mutableStateOf(false) }
        DisposableEffect(state) { onDispose { state.close() } }
        LaunchedEffect(state, owner) {
            owner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
                if (!state.dirty && state.pending == null) state.refresh()
                kotlinx.coroutines.awaitCancellation()
            }
        }
        content(when {
            state.busy && state.view == null -> "Chargement..."
            state.view == null -> "Indisponible"
            else -> state.view?.city ?: "Non renseignée"
        }, { state.discard(); editing = true })
        if (editing) ProfileCityDialog(state, onClose = { if (!state.busy) { state.discard(); editing = false } },
            onRefresh = { scope.launch { state.refresh() } },
            onSave = { remove -> scope.launch { if (state.save(remove)) editing = false } })
    }
}
