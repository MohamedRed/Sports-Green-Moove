package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun TeamEnrollmentScreen(state: TeamEnrollmentState, onBack: () -> Unit, onRefresh: () -> Unit,
    onPick: (TeamEnrollmentOptionKind) -> Unit, onChildMode: (Boolean) -> Unit, onReview: () -> Unit,
    onAction: (TeamEnrollmentView, TeamEnrollmentAction) -> Unit) {
    BackHandler(onBack = onBack)
    V2Screen(testTag = "team-enrollment.screen") {
        V2TopBar("ÉQUIPES", onBack = onBack, trailing = { GroupsRefreshButton(state.busy, onRefresh) })
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (state.busy) Text("Chargement...", color = Sgm.colors.textSecondary, modifier = Modifier.testTag("team-enrollment.loading"))
            state.error?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("team-enrollment.error")) }
            state.notice?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("team-enrollment.notice")) }
            TeamSelector("Club", state.clubs.items.find { it.id == state.clubId }?.name, state.clubs.loaded && !state.busy,
                "team-enrollment.club") { onPick(TeamEnrollmentOptionKind.Clubs) }
            state.clubs.error?.let { Text(it, color = Sgm.colors.textPrimary) }
            TeamSelector("Équipe", state.teams.items.find { it.id == state.teamId }?.name, state.teams.loaded && !state.busy,
                "team-enrollment.team") { onPick(TeamEnrollmentOptionKind.Teams) }
            state.teams.error?.let { Text(it, color = Sgm.colors.textPrimary) }
            if (state.canChooseChild) {
                Text("Inscription pour", color = Sgm.colors.textSecondary)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    listOf(false to "Moi", true to "Mon enfant").forEach { (child, label) ->
                        Row(Modifier.weight(1f).heightIn(min = 48.dp).testTag("team-enrollment.subject.$child")
                            .selectable(state.childMode == child, enabled = !state.busy, role = Role.RadioButton, onClick = { onChildMode(child) })) {
                            RadioButton(selected = state.childMode == child, onClick = null, enabled = !state.busy)
                            Text(label, color = Sgm.colors.textPrimary, modifier = Modifier.weight(1f).padding(vertical = 12.dp))
                        }
                    }
                }
            }
            if (state.childMode) {
                TeamSelector("Enfant", state.children.items.find { it.id == state.childId }?.name, state.children.loaded && !state.busy,
                    "team-enrollment.child") { onPick(TeamEnrollmentOptionKind.Children) }
                state.children.error?.let { Text(it, color = Sgm.colors.textPrimary) }
            }
            GuardianActionButton("Vérifier l’inscription", "team-enrollment.review", state.canReview, onReview)
            state.view?.let { view ->
                Text(view.subjectName ?: "Nom indisponible", style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
                Text(view.teamName ?: "Nom de l’équipe indisponible", color = Sgm.colors.textPrimary)
                Text(view.statusLabel, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("team-enrollment.status"))
                view.allowedActions.forEach { action ->
                    GuardianActionButton(teamEnrollmentActionLabel(view, action), "team-enrollment.action.${action.wire}", !state.busy &&
                        (action != TeamEnrollmentAction.Request || view.subjectName != null && view.teamName != null)) { onAction(view, action) }
                }
            }
        }
    }
}

@Composable
private fun TeamSelector(label: String, selected: String?, enabled: Boolean, tag: String, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = Sgm.colors.textSecondary); GuardianActionButton(selected ?: "Choisir", tag, enabled, onClick)
    }
}
internal fun teamEnrollmentActionLabel(view: TeamEnrollmentView, action: TeamEnrollmentAction) = when (action) {
    TeamEnrollmentAction.Request -> if (view.status == null) "Demander l’inscription" else "Nouvelle demande"
    TeamEnrollmentAction.Withdraw -> if (view.status == TeamEnrollmentStatus.Approved) "Retirer l’inscription" else "Retirer la demande"
}
