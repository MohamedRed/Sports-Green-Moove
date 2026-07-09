package be.sportgreenmoove.app.services

import android.app.Activity
import android.content.Context
import be.sportgreenmoove.app.data.AuthSession
import com.facebook.CallbackManager
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.FacebookSdk
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult
import com.google.firebase.auth.FacebookAuthProvider
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class FirebaseAndroidFacebookSocialAuthGateway(
    private val context: Context,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : FacebookSocialAuthGateway {
    override val isConfigured: Boolean
        get() = facebookAppId() != null && facebookClientToken() != null

    override suspend fun signIn(activity: Activity): AuthSession {
        val appId = facebookAppId()
            ?: throw ProviderConfigurationException("Configurez SGM_FACEBOOK_APP_ID pour Facebook Auth Android.")
        val clientToken = facebookClientToken()
            ?: throw ProviderConfigurationException("Configurez SGM_FACEBOOK_CLIENT_TOKEN pour Facebook Auth Android.")

        FacebookSdk.setApplicationId(appId)
        FacebookSdk.setClientToken(clientToken)
        return suspendCancellableCoroutine { continuation ->
            val completed = AtomicBoolean(false)
            val callbackManager = CallbackManager.Factory.create()
            val bridgeRegistration = FacebookActivityResultBridge.register(callbackManager)
            val loginManager = LoginManager.getInstance()

            fun completeWithError(error: Throwable) {
                if (!completed.compareAndSet(false, true)) return
                bridgeRegistration.close()
                loginManager.unregisterCallback(callbackManager)
                continuation.resumeWithException(error)
            }

            fun completeWithSession(session: AuthSession) {
                if (!completed.compareAndSet(false, true)) return
                bridgeRegistration.close()
                loginManager.unregisterCallback(callbackManager)
                continuation.resume(session)
            }

            loginManager.registerCallback(
                callbackManager,
                object : FacebookCallback<LoginResult> {
                    override fun onSuccess(result: LoginResult) {
                        val token = result.accessToken.token
                        if (token.isNullOrBlank()) {
                            completeWithError(ProviderConfigurationException("Jeton Facebook Android invalide."))
                            return
                        }
                        val credential = FacebookAuthProvider.getCredential(token)
                        auth.signInWithCredential(credential)
                            .addOnSuccessListener { authResult ->
                                val user = authResult.user
                                if (user == null) {
                                    completeWithError(ProviderConfigurationException("Réponse Facebook Auth invalide."))
                                } else {
                                    completeWithSession(AuthSession(uid = user.uid, email = user.email, displayName = user.displayName))
                                }
                            }
                            .addOnFailureListener(::completeWithError)
                    }

                    override fun onCancel() {
                        completeWithError(ProviderConfigurationException("Connexion Facebook annulée."))
                    }

                    override fun onError(error: FacebookException) {
                        completeWithError(error)
                    }
                },
            )

            continuation.invokeOnCancellation {
                if (completed.compareAndSet(false, true)) {
                    bridgeRegistration.close()
                    loginManager.unregisterCallback(callbackManager)
                }
            }
            loginManager.logInWithReadPermissions(activity, listOf("public_profile", "email"))
        }
    }

    override fun signOut() {
        LoginManager.getInstance().logOut()
    }

    private fun facebookAppId(): String? =
        stringResource("facebook_app_id")

    private fun facebookClientToken(): String? =
        stringResource("facebook_client_token")

    private fun stringResource(name: String): String? {
        val id = context.resources.getIdentifier(name, "string", context.packageName)
        if (id == 0) return null
        return context.getString(id).takeIf { it.isNotBlank() }
    }
}
