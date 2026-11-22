package be.sportgreenmoove.app.ui

import android.content.Context
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.services.*
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

internal class LocalTeamPushSignOutContract(context: Context, private val delegate: AuthGateway, runId: String) : AutoCloseable {
    private val auth = FirebaseAuth.getInstance()
    private val root = File(context.noBackupFilesDir, "isolated-push-signout-$runId")
    private val journal = TeamPushJournal(FileTeamPushStorage(root))
    private var tokenCalls = 0
    private var confirmedWhileAuthenticated = false
    private var uidBeforeAuthClear: String? = null
    private var activationRevision = 0L
    private var removalRevision = 0L
    private var tokenAutoInit = false
    private val registration = FirebaseAndroidTeamPushRegistration(auth)
    private val lifecycle = TeamPushLifecycle(journal, object : TeamPushTokenSource {
        override fun setAutoInit(enabled: Boolean) { tokenAutoInit = enabled }
        override suspend fun token(): String { tokenCalls++; return "synthetic_local_phone_$runId" }
        override suspend fun deleteToken() = Unit
    }, { auth.currentUser?.uid }, { it == "sgm-qa-driver" }, registration::register)
    init {
        check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        check(FirebaseApp.getApps(context).all { it.options.projectId == "demo-sgm-local-qa" })
        check(!root.exists())
    }
    val gateway = object : AuthGateway by delegate {
        override suspend fun prepareSignOut(): SessionExitResult {
            delegate.prepareSignOut()
            val result = lifecycle.prepareSignOut()
            if (activationRevision > 0) {
                check(result == SessionExitResult.Confirmed && auth.currentUser?.uid == "sgm-qa-driver")
                check(journal.current().pending == null && journal.current().ownerUid == null && !tokenAutoInit)
                confirmedWhileAuthenticated = true; removalRevision = journal.current().revision
            }
            return result
        }
        override fun signOut() {
            uidBeforeAuthClear = auth.currentUser?.uid
            try { lifecycle.signedOut() } finally { delegate.signOut() }
        }
    }
    suspend fun activateDriver() {
        check(auth.currentUser?.uid == "sgm-qa-driver")
        lifecycle.accountChanged("sgm-qa-driver")
        check(lifecycle.synchronize(true) == TeamPushSyncResult.Registered)
        activationRevision = checkNotNull(journal.current().confirmed).revision
    }
    fun receipt(): JSONObject {
        check(confirmedWhileAuthenticated && uidBeforeAuthClear == "sgm-qa-driver" && auth.currentUser == null)
        check(activationRevision > 0 && removalRevision > activationRevision && journal.current().pending == null)
        check(journal.current().signOutUid == "sgm-qa-driver")
        val encoded = JSONArray().put("team-push-installation").put(journal.current().identity.id).toString()
        val hash = MessageDigest.getInstance("SHA-256").digest(encoded.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        return JSONObject().put("scope", "isolated-native-ui-signout-with-synthetic-phone-token")
            .put("installationHash", hash).put("activationRevision", activationRevision).put("removalRevision", removalRevision)
            .put("confirmedWhileAuthenticated", true).put("authAbsentAfter", true).put("uiLoginReturned", true)
            .put("durableSignOutIntent", true)
            .put("syntheticTokenCalls", tokenCalls).put("realMessagingSdkCalls", 0).put("pushDeliveryVerified", false)
    }
    override fun close() { check(root.deleteRecursively()) }
}
