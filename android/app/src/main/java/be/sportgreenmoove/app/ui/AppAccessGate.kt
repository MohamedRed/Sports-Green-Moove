package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CoroutineScope

@Composable
internal fun AppAccessGate(
    providers: AndroidProviderSet, restoration: SessionRestorationState, session: AuthSession?, shutdownPending: Boolean,
    loading: Boolean, error: String?, scope: CoroutineScope, logout: () -> Unit,
    setLoading: (Boolean) -> Unit, setError: (String?) -> Unit, setSession: (AuthSession?) -> Unit,
    refreshAppData: suspend () -> Unit, content: @Composable () -> Unit,
) {
    when {
        shutdownPending -> SessionExitScreen()
        !providers.isConfigured -> ConfigurationRequiredScreen()
        restoration.phase != SessionRestorationPhase.Ready -> SessionRestorationScreen(restoration, logout) { setSession(it) }
        session == null -> OnboardingRoute(loading, error, providers, scope, setLoading, setError, { setSession(it) }, refreshAppData)
        else -> content()
    }
}

@Composable
internal fun SessionExitScreen() {
    V2Screen(testTag = "session.exit.screen") {
        Column(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(Modifier.sgmTestTag("session.exit.pending"), color = Sgm.colors.textAccent)
            Text("Déconnexion…", style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary),
                modifier = Modifier.sgmTestTag("session.exit.label"))
        }
    }
}
