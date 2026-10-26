package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
internal fun ChildAccountLinkDialog(uid: String, gateway: ChildAccountLinkGateway,
    target: ChildAccountLinkTarget? = null, onClose: () -> Unit) {
    val state = remember(uid, gateway, target) { ChildAccountLinkState(uid, target, gateway) }
    val scope = rememberCoroutineScope(); val owner = LocalLifecycleOwner.current
    val focus = LocalFocusManager.current
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try { awaitCancellation() } finally { state.leaveForeground() }
        }
    }
    LaunchedEffect(state.code) { state.code?.let { delay((it.expiresAtMillis - System.currentTimeMillis()).coerceAtLeast(0)); state.expireCode() } }
    AlertDialog(onDismissRequest = onClose, title = { Text("Lier le compte enfant") }, text = {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            target?.let { Text(it.childName) }
            if (state.busy) Text("Chargement...")
            state.error?.let { Text(it, modifier = Modifier.testTag("child-link.error")) }
            if (state.approved) Text("Compte lié.", modifier = Modifier.testTag("child-link.approved"))
            else if (target == null) {
                state.code?.let { code ->
                    SelectionContainer { Text(code.code.chunked(8).joinToString("\n"), modifier = Modifier.testTag("child-link.code")) }
                    Text("Valable 10 minutes.")
                }
                OutlinedButton(onClick = { scope.launch { state.create() } }, enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth().testTag("child-link.create")) { Text("Créer un code") }
            } else {
                OutlinedTextField(state.input, state::edit, label = { Text("Code du compte enfant") },
                    enabled = !state.busy, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Done, autoCorrectEnabled = false),
                    keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
                    modifier = Modifier.fillMaxWidth().testTag("child-link.input"))
                OutlinedButton(onClick = { scope.launch { state.approve() } }, enabled = state.canApprove,
                    modifier = Modifier.fillMaxWidth().testTag("child-link.approve")) { Text("Autoriser la liaison") }
            }
        }
    }, confirmButton = { TextButton(onClick = onClose) { Text("Fermer") } })
}
