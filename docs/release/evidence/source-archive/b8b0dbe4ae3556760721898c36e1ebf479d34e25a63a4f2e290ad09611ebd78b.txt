package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.services.TeamEnrollmentGateway
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch

@Composable
internal fun TeamEnrollmentHistoryRoute(uid: String, gateway: TeamEnrollmentGateway, onBack: () -> Unit) {
    val state = remember(uid, gateway) { TeamEnrollmentHistoryState(uid, gateway) }
    val scope = rememberCoroutineScope(); val owner = LocalLifecycleOwner.current
    var confirm by remember(state) { mutableStateOf<TeamEnrollmentView?>(null) }
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try { state.refresh(); awaitCancellation() } finally { confirm = null; state.clear() }
        }
    }
    LaunchedEffect(state.selected) { confirm = null }
    TeamEnrollmentHistoryScreen(state, onBack, showSelected = confirm == null, onRefresh = { confirm = null; scope.launch { state.refresh() } },
        onMore = { scope.launch { state.more() } }, onSelect = { id -> scope.launch { state.select(id) } },
        onDismiss = state::dismiss, onWithdraw = { confirm = it })
    confirm?.let { expected ->
        AlertDialog(onDismissRequest = { confirm = null }, containerColor = Sgm.colors.bgCard,
            titleContentColor = Sgm.colors.textPrimary, textContentColor = Sgm.colors.textPrimary,
            title = { Text("${teamEnrollmentActionLabel(expected, TeamEnrollmentAction.Withdraw)} ?") },
            text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(expected.subjectName ?: if (expected.childId == null) "Moi" else "Enfant indisponible")
                Text(expected.teamName ?: "Équipe indisponible")
            } }, confirmButton = { TextButton(onClick = { confirm = null; scope.launch { state.withdraw(expected) } },
                modifier = Modifier.testTag("team-history.confirm")) { Text("Confirmer", color = Sgm.colors.textPrimary) } },
            dismissButton = { TextButton(onClick = { confirm = null }, modifier = Modifier.testTag("team-history.keep")) {
                Text("Revenir", color = Sgm.colors.textPrimary)
            } })
    }
}
