package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.AuthGateway
import kotlinx.coroutines.launch

@Composable
internal fun rememberSessionRestoration(auth: AuthGateway, enabled: Boolean,
    accept: suspend (AuthSession?) -> Unit): SessionRestorationState {
    val state = remember(auth) { SessionRestorationState(auth::currentSession) }
    val currentAccept by rememberUpdatedState(accept)
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, state.attempt, enabled) {
        if (enabled) state.restore { currentAccept(it) }
    }
    return state
}

@Composable
internal fun SessionRestorationScreen(state: SessionRestorationState, onDisconnect: () -> Unit,
    accept: suspend (AuthSession?) -> Unit) {
    val scope = rememberCoroutineScope()
    V2Screen(testTag = "session.restore.screen") {
        V2TopBar("CONNEXION")
        Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            if (state.phase == SessionRestorationPhase.Failed) {
                Text("Impossible de restaurer votre session.", style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary),
                    modifier = Modifier.sgmTestTag("session.restore.error"))
                V2Button("Réessayer", state::retry, full = true, testTag = "session.restore.retry")
                V2Button("Se déconnecter", { scope.launch { state.disconnect(onDisconnect, accept) } },
                    full = true, variant = V2ButtonVariant.Secondary, testTag = "session.restore.disconnect")
            } else {
                CircularProgressIndicator(color = Sgm.colors.textPrimary, modifier = Modifier.sgmTestTag("session.restore.loading"))
            }
        }
    }
}
