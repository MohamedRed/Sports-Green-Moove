package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CoroutineScope

@Composable
fun rememberSearchController(
    providers: AndroidProviderSet,
    scope: CoroutineScope,
    sessionUid: String?,
    onError: (String?) -> Unit,
    onNotice: (String) -> Unit,
    onAppLoading: (Boolean) -> Unit,
): SearchController {
    val currentError by rememberUpdatedState(onError)
    val currentNotice by rememberUpdatedState(onNotice)
    val currentLoading by rememberUpdatedState(onAppLoading)
    val controller = remember(providers, scope, sessionUid) {
        SearchController(providers, scope, { currentError(it) }, { currentNotice(it) }, { currentLoading(it) })
    }
    DisposableEffect(controller) { onDispose { controller.close() } }
    return controller
}
