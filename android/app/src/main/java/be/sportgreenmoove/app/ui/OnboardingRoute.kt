package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun OnboardingRoute(
    loading: Boolean,
    error: String?,
    providers: AndroidProviderSet,
    scope: CoroutineScope,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    setSession: (AuthSession) -> Unit,
    refreshAppData: suspend () -> Unit,
) {
    val context = LocalContext.current
    OnboardingScreen(
        loading = loading,
        error = error,
        onSubmit = { mode, name, email, password ->
            scope.launch {
                setLoading(true)
                setError(null)
                runCatching {
                    val session = if (mode == OnboardingMode.Login) {
                        providers.auth.signIn(email, password)
                    } else {
                        providers.auth.signUp(name, email, password)
                    }
                    setSession(session)
                    refreshAppData()
                }.onFailure { setError(it.message) }
                setLoading(false)
            }
        },
        onGoogle = {
            scope.launch {
                val activity = context.findActivity()
                if (activity == null) {
                    setError("Activité Android indisponible pour Google Auth.")
                    return@launch
                }
                setLoading(true)
                setError(null)
                runCatching {
                    val session = providers.googleAuth.signIn(activity)
                    setSession(session)
                    refreshAppData()
                }.onFailure { setError(it.message) }
                setLoading(false)
            }
        },
        onFacebook = {
            scope.launch {
                val activity = context.findActivity()
                if (activity == null) {
                    setError("Activité Android indisponible pour Facebook Auth.")
                    return@launch
                }
                setLoading(true)
                setError(null)
                runCatching {
                    val session = providers.facebookAuth.signIn(activity)
                    setSession(session)
                    refreshAppData()
                }.onFailure { setError(it.message) }
                setLoading(false)
            }
        },
    )
}
