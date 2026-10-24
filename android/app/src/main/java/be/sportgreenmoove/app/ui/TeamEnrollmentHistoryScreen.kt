package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun TeamEnrollmentHistoryScreen(state: TeamEnrollmentHistoryState, onBack: () -> Unit, showSelected: Boolean, onRefresh: () -> Unit,
    onMore: () -> Unit, onSelect: (String) -> Unit, onDismiss: () -> Unit, onWithdraw: (TeamEnrollmentView) -> Unit) {
    BackHandler(onBack = onBack)
    V2Screen(testTag = "team-history.screen") {
        V2TopBar("MES DEMANDES", onBack = onBack, trailing = {
            V2CircleIconButton(SgmIcon.Refresh, onRefresh, size = 44, enabled = !state.busy,
                testTag = "team-history.refresh", description = "Actualiser les demandes")
        })
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (state.busy) Text("Chargement...", color = Sgm.colors.textPrimary, modifier = Modifier.testTag("team-history.loading"))
            state.error?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("team-history.error")) }
            state.notice?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("team-history.notice")) }
            state.requests.error?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("team-history.list-error")) }
            if (state.requests.loaded && state.requests.items.isEmpty())
                Text("Vous n’avez pas encore de demande.", color = Sgm.colors.textPrimary, modifier = Modifier.testTag("team-history.empty"))
            state.requests.items.forEach { view ->
                Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).testTag("team-history.row.${view.id}")
                    .clickable(enabled = !state.busy, role = Role.Button) { onSelect(view.id) }.padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(view.teamName ?: "Équipe indisponible", style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
                        Text(view.subjectName ?: if (view.childId == null) "Moi" else "Enfant indisponible", color = Sgm.colors.textPrimary)
                        Text(view.statusLabel, color = Sgm.colors.textPrimary)
                    }
                    SgmLineIcon(SgmIcon.ChevronRight, Sgm.colors.textPrimary, Modifier.size(20.dp))
                }
            }
            if (state.requests.hasMore) GuardianActionButton("Charger la suite", "team-history.more", !state.busy, onMore)
        }
    }
    state.selected?.takeIf { showSelected }?.let { view ->
        AlertDialog(onDismissRequest = onDismiss, containerColor = Sgm.colors.bgCard,
            titleContentColor = Sgm.colors.textPrimary, textContentColor = Sgm.colors.textPrimary,
            title = { Text(view.teamName ?: "Équipe indisponible", style = SgmType.BodyLG) },
            text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(view.subjectName ?: if (view.childId == null) "Moi" else "Enfant indisponible", modifier = Modifier.testTag("team-history.subject"))
                Text(view.statusLabel, modifier = Modifier.testTag("team-history.status"))
            } }, confirmButton = {
                if (TeamEnrollmentAction.Withdraw in view.allowedActions) TextButton(onClick = { onWithdraw(view) },
                    modifier = Modifier.testTag("team-history.withdraw")) { Text(teamEnrollmentActionLabel(view, TeamEnrollmentAction.Withdraw), color = Sgm.colors.textPrimary) }
            }, dismissButton = { TextButton(onClick = onDismiss, modifier = Modifier.testTag("team-history.close")) {
                Text("Fermer", color = Sgm.colors.textPrimary)
            } })
    }
}
