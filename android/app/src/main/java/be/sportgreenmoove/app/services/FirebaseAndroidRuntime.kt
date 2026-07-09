package be.sportgreenmoove.app.services

import android.content.Context
import android.util.Log
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.appRoleFromClaim
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
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
            FirebaseAndroidEmulatorConfig.configureIfRequested()
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

private object FirebaseAndroidEmulatorConfig {
    private var configured = false

    fun configureIfRequested() {
        if (!BuildConfig.SGM_USE_FIREBASE_EMULATOR || configured) return
        configured = true
        val host = BuildConfig.SGM_FIREBASE_EMULATOR_HOST
        if (BuildConfig.DEBUG) Log.d("SGM.FirebaseEmulator", "Configuring Firebase emulators at $host")
        FirebaseAuth.getInstance().useEmulator(host, 9099)
        FirebaseFirestore.getInstance().useEmulator(host, 8080)
        FirebaseFunctions.getInstance().useEmulator(host, 5001)
        FirebaseDatabase.getInstance().useEmulator(host, 9000)
    }
}

private class FirebaseAndroidAuthGateway : AuthGateway {
    private val auth = FirebaseAuth.getInstance()
    private val functions = FirebaseFunctions.getInstance()
    override val isConfigured: Boolean = true

    override suspend fun currentSession(): AuthSession? =
        auth.currentUser?.let { initializeUserProfile(it) }

    override suspend fun signIn(email: String, password: String): AuthSession {
        val result = auth.signInWithEmailAndPassword(email, password).await()
        val user = result.user ?: throw ProviderConfigurationException("Réponse Firebase Auth invalide.")
        return initializeUserProfile(user)
    }

    override suspend fun signUp(name: String, email: String, password: String): AuthSession {
        val result = auth.createUserWithEmailAndPassword(email, password).await()
        val user = result.user ?: throw ProviderConfigurationException("Réponse Firebase Auth invalide.")
        return initializeUserProfile(user, displayName = name)
    }

    override fun signOut() {
        auth.signOut()
    }

    private suspend fun initializeUserProfile(user: FirebaseUser, displayName: String? = null): AuthSession {
        val data = mutableMapOf<String, Any>()
        displayName?.takeIf(String::isNotBlank)?.let { data["displayName"] = it }
        if (BuildConfig.DEBUG) Log.d("SGM.FirebaseEmulator", "Calling initializeUserProfile for ${user.uid}")
        val result = runCatching {
            functions.getHttpsCallable("initializeUserProfile").call(data).await()
        }.onFailure {
            if (BuildConfig.DEBUG) Log.e("SGM.FirebaseEmulator", "initializeUserProfile failed", it)
        }.getOrThrow()
        if (BuildConfig.DEBUG) Log.d("SGM.FirebaseEmulator", "initializeUserProfile succeeded for ${user.uid}")
        val profile = result.data as? Map<*, *>
        user.getIdToken(true).await()
        return AuthSession(
            uid = user.uid,
            email = profile?.get("email") as? String ?: user.email,
            displayName = profile?.get("displayName") as? String ?: displayName ?: user.displayName,
            roles = profileRoles(profile),
        )
    }

    private fun profileRoles(profile: Map<*, *>?): Set<AppRole> =
        (profile?.get("roleKeys") as? List<*>)
            ?.mapNotNull { it as? String }
            ?.mapNotNull(::appRoleFromClaim)
            ?.toSet()
            ?.takeIf { it.isNotEmpty() }
            ?: setOf(AppRole.Parent)
}
