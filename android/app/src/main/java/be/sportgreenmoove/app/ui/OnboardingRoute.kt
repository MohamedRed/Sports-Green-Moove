package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.domain.AuthFormMode
import be.sportgreenmoove.app.domain.AuthFormPolicy
import be.sportgreenmoove.app.domain.AuthFormValidation
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
            val validation = AuthFormPolicy.validate(mode.toAuthFormMode(), name, email, password)
            if (validation is AuthFormValidation.Invalid) {
                setError(validation.message)
                return@OnboardingScreen
            }
            val payload = (validation as AuthFormValidation.Valid).payload
            scope.launch {
                setLoading(true)
                setError(null)
                runCatching {
                    val session = if (mode == OnboardingMode.Login) {
                        providers.auth.signIn(payload.email, payload.password)
                    } else {
                        providers.auth.signUp(payload.name, payload.email, payload.password)
                    }
                    setSession(session)
                    refreshAppData()
                }.onFailure { setError(AuthFormPolicy.userMessageFor(it)) }
                setLoading(false)
            }
        },
        onClearError = { setError(null) },
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
                }.onFailure { setError(AuthFormPolicy.userMessageFor(it)) }
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
                }.onFailure { setError(AuthFormPolicy.userMessageFor(it)) }
                setLoading(false)
            }
        },
    )
}

private fun OnboardingMode.toAuthFormMode(): AuthFormMode =
    when (this) {
        OnboardingMode.Login -> AuthFormMode.Login
        OnboardingMode.SignUp -> AuthFormMode.SignUp
    }
