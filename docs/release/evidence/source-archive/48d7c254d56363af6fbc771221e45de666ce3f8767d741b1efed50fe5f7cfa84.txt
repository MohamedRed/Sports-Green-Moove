package be.sportgreenmoove.app.ui

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch

@Composable
internal fun ChildInvitationDialog(uid: String, target: ChildAccountLinkTarget, gateway: ChildInvitationGateway,
    onClose: () -> Unit, share: ((String) -> Unit)? = null) {
    val state = remember(uid, target, gateway) { ChildInvitationState(uid, target, gateway) }
    val scope = rememberCoroutineScope(); val owner = LocalLifecycleOwner.current; val context = LocalContext.current
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try { state.refresh(); awaitCancellation() } finally { state.leaveForeground() }
        }
    }
    AlertDialog(onDismissRequest = onClose, containerColor = Sgm.colors.bgCard,
        titleContentColor = Sgm.colors.textPrimary, textContentColor = Sgm.colors.textPrimary,
        title = { Text("Inviter cet enfant") }, text = {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(target.childName)
                if (state.busy) Text("Chargement...")
                state.error?.let { Text(it, modifier = Modifier.testTag("child-invitation.error")) }
                state.current?.let {
                    Text(when (it.status) { "accepted" -> "Compte créé."; "provisioning" -> "Inscription à terminer."
                        "revoked" -> "Invitation annulée."; else -> "Invitation créée." }, modifier = Modifier.testTag("child-invitation.status"))
                }
                EmergencyContactButton(if (state.current?.status == "pending") "Remplacer l’invitation" else "Créer l’invitation",
                    "child-invitation.create", state.canCreate, { scope.launch { state.create() } })
                EmergencyContactButton("Partager le lien", "child-invitation.share", state.canShare, {
                    if (owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) state.share { link ->
                        if (share != null) share(link) else context.startActivity(Intent.createChooser(
                            Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, link), "Partager l’invitation"))
                    }
                })
                EmergencyContactButton("Annuler l’invitation", "child-invitation.revoke", state.canRevoke, { scope.launch { state.revoke() } })
                EmergencyContactButton("Actualiser", "child-invitation.refresh", !state.busy, { scope.launch { state.refresh() } }, SgmIcon.Refresh)
            }
        }, confirmButton = { TextButton(onClick = onClose) { Text("Fermer", color = Sgm.colors.textPrimary) } })
}
