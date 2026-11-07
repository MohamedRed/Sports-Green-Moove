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
internal fun TeamEnrollmentRoute(uid: String, gateway: TeamEnrollmentGateway, canChooseChild: Boolean, onBack: () -> Unit) {
    val state = remember(uid, gateway, canChooseChild) { TeamEnrollmentState(uid, gateway, canChooseChild) }
    val scope = rememberCoroutineScope(); val owner = LocalLifecycleOwner.current
    var picker by remember(state) { mutableStateOf<TeamEnrollmentOptionKind?>(null) }
    var confirmation by remember(state) { mutableStateOf<Pair<TeamEnrollmentView, TeamEnrollmentAction>?>(null) }
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try { state.refresh(); awaitCancellation() }
            finally { picker = null; confirmation = null; state.clear() }
        }
    }
    LaunchedEffect(state.view) { confirmation = null }
    TeamEnrollmentScreen(state, onBack, onRefresh = { picker = null; confirmation = null; scope.launch { state.refresh() } },
        onPick = { picker = it }, onChildMode = { scope.launch { state.chooseChildMode(it) } }, onReview = { scope.launch { state.review() } },
        onAction = { view, action -> confirmation = view to action })
    picker?.let { kind ->
        val page = when (kind) { TeamEnrollmentOptionKind.Clubs -> state.clubs; TeamEnrollmentOptionKind.Teams -> state.teams; TeamEnrollmentOptionKind.Children -> state.children }
        val selected = when (kind) { TeamEnrollmentOptionKind.Clubs -> state.clubId; TeamEnrollmentOptionKind.Teams -> state.teamId; TeamEnrollmentOptionKind.Children -> state.childId }
        val title = when (kind) { TeamEnrollmentOptionKind.Clubs -> "Choisir un club"; TeamEnrollmentOptionKind.Teams -> "Choisir une équipe"; TeamEnrollmentOptionKind.Children -> "Choisir un enfant" }
        TeamEnrollmentOptionDialog(title, page, selected, onChoose = { id ->
            picker = null; scope.launch { when (kind) {
                TeamEnrollmentOptionKind.Clubs -> state.chooseClub(id); TeamEnrollmentOptionKind.Teams -> state.chooseTeam(id); TeamEnrollmentOptionKind.Children -> state.chooseChild(id)
            } }
        }, onMore = { scope.launch { page.more() } }, onRetry = { scope.launch { page.reload() } }, onClose = { picker = null })
    }
    confirmation?.let { (view, action) ->
        AlertDialog(onDismissRequest = { confirmation = null }, containerColor = Sgm.colors.bgCard,
            titleContentColor = Sgm.colors.textPrimary, textContentColor = Sgm.colors.textPrimary,
            title = { Text("${teamEnrollmentActionLabel(view, action)} ?") },
            text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(view.subjectName ?: "Nom indisponible"); Text(view.teamName ?: "Nom de l’équipe indisponible")
            } }, confirmButton = { TextButton(onClick = { confirmation = null; scope.launch { state.submit(view, action) } },
                modifier = Modifier.testTag("team-enrollment.confirm")) { Text("Confirmer", color = Sgm.colors.textPrimary) } },
            dismissButton = { TextButton(onClick = { confirmation = null }, modifier = Modifier.testTag("team-enrollment.keep")) { Text("Revenir", color = Sgm.colors.textPrimary) } })
    }
}
