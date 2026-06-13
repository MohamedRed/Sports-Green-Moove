package be.sportgreenmoove.app.services

import android.app.Activity
import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import be.sportgreenmoove.app.data.AuthSession
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.Companion.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class FirebaseAndroidGoogleSocialAuthGateway(
    private val context: Context,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : GoogleSocialAuthGateway {
    private val credentialManager = CredentialManager.create(context)
    private val signOutScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    override val isConfigured: Boolean
        get() = webClientId() != null

    override suspend fun signIn(activity: Activity): AuthSession {
        val serverClientId = webClientId()
            ?: throw ProviderConfigurationException("Client OAuth Google manquant dans google-services.json.")
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(serverClientId)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()
        val credential = credentialManager.getCredential(activity, request).credential
        val idToken = googleIdToken(credential)
        val firebaseCredential = GoogleAuthProvider.getCredential(idToken, null)
        val result = auth.signInWithCredential(firebaseCredential).await()
        val user = result.user ?: throw ProviderConfigurationException("Réponse Google Auth invalide.")
        return AuthSession(uid = user.uid, email = user.email)
    }

    override fun signOut() {
        signOutScope.launch {
            runCatching { credentialManager.clearCredentialState(ClearCredentialStateRequest()) }
        }
    }

    private fun webClientId(): String? {
        val id = context.resources.getIdentifier("default_web_client_id", "string", context.packageName)
        if (id == 0) return null
        return context.getString(id).takeIf { it.isNotBlank() && it != "default_web_client_id" }
    }

    private fun googleIdToken(credential: androidx.credentials.Credential): String {
        if (credential !is CustomCredential || credential.type != TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            throw ProviderConfigurationException("Identifiant Google invalide.")
        }
        return try {
            GoogleIdTokenCredential.createFrom(credential.data).idToken
        } catch (error: GoogleIdTokenParsingException) {
            throw ProviderConfigurationException(error.localizedMessage ?: "Jeton Google invalide.")
        }
    }
}
