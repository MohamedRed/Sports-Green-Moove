package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.data.AuthSession
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

data class AndroidProviderSet(
    val auth: AuthGateway,
    val firebase: FirebaseGateway,
    val googleAuth: GoogleSocialAuthGateway = UnconfiguredGoogleSocialAuthGateway(),
    val facebookAuth: FacebookSocialAuthGateway = UnconfiguredFacebookSocialAuthGateway(),
    val radar: RadarTrackingGateway = UnconfiguredRadarTrackingGateway(),
    val stripe: StripePaymentsGateway = UnconfiguredStripePaymentsGateway(),
) {
    val isConfigured: Boolean = auth.isConfigured && firebase.isConfigured
}

object AndroidRuntime {
    fun create(context: Context): AndroidProviderSet {
        val app = FirebaseApp.initializeApp(context) ?: FirebaseApp.getApps(context).firstOrNull()
        return if (app == null) {
            AndroidProviderSet(auth = UnconfiguredAuthGateway(), firebase = UnconfiguredFirebaseGateway())
        } else {
            AndroidProviderSet(
                auth = FirebaseAndroidAuthGateway(),
                firebase = FirebaseAndroidBackendGateway(context.applicationContext),
                googleAuth = FirebaseAndroidGoogleSocialAuthGateway(context.applicationContext),
                facebookAuth = FirebaseAndroidFacebookSocialAuthGateway(context.applicationContext),
                radar = FirebaseAndroidRadarTrackingGateway(
                    context = context.applicationContext,
                    publishableKey = context.getString(R.string.sgm_radar_publishable_key),
                ),
                stripe = FirebaseAndroidStripePaymentsGateway(),
            )
        }
    }
}

private class FirebaseAndroidAuthGateway : AuthGateway {
    private val auth = FirebaseAuth.getInstance()
    override val isConfigured: Boolean = true

    override suspend fun currentSession(): AuthSession? =
        auth.currentUser?.let { AuthSession(uid = it.uid, email = it.email) }

    override suspend fun signIn(email: String, password: String): AuthSession {
        val result = auth.signInWithEmailAndPassword(email, password).await()
        val user = result.user ?: throw ProviderConfigurationException("Réponse Firebase Auth invalide.")
        return AuthSession(uid = user.uid, email = user.email)
    }

    override suspend fun signUp(name: String, email: String, password: String): AuthSession {
        val result = auth.createUserWithEmailAndPassword(email, password).await()
        val user = result.user ?: throw ProviderConfigurationException("Réponse Firebase Auth invalide.")
        return AuthSession(uid = user.uid, email = user.email)
    }

    override fun signOut() {
        auth.signOut()
    }
}
