package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun GuardianVerificationScreen(
    state: GuardianVerificationState, onBack: () -> Unit, onRefresh: () -> Unit, onPick: (GuardianOptionKind) -> Unit,
    onReview: () -> Unit, onHistory: (GuardianVerification) -> Unit, onMoreHistory: () -> Unit,
    onAction: (GuardianVerification, GuardianParentAction) -> Unit,
) {
    BackHandler(onBack = onBack)
    V2Screen(testTag = "guardian.screen") {
        V2TopBar("PARENTS ET ENFANTS", onBack = onBack, trailing = { GroupsRefreshButton(state.busy, onRefresh) })
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (state.busy) Text("Chargement...", color = Sgm.colors.textSecondary, modifier = Modifier.testTag("guardian.loading"))
            state.notice?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("guardian.notice")) }
            state.error?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("guardian.error")) }
            Text("Votre demande", style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
            GuardianSelector("Enfant", state.children.items.find { it.id == state.childId }?.name, state.children.loaded && !state.busy,
                "guardian.child", { onPick(GuardianOptionKind.Children) })
            state.children.error?.let { Text(it, color = Sgm.colors.textPrimary) }
            GuardianSelector("Club", state.clubs.items.find { it.id == state.clubId }?.name, state.clubs.loaded && !state.busy,
                "guardian.club", { onPick(GuardianOptionKind.Clubs) })
            state.clubs.error?.let { Text(it, color = Sgm.colors.textPrimary) }
            GuardianActionButton("Voir la demande", "guardian.review", state.canReview, onReview)
            state.view?.let { view ->
                Column(Modifier.fillMaxWidth().testTag("guardian.current"), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(view.childName ?: "Nom de l’enfant indisponible", style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
                    Text(view.clubName ?: "Nom du club indisponible", color = Sgm.colors.textSecondary)
                    Text(view.statusLabel, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("guardian.status"))
                    view.allowedActions.forEach { action ->
                        GuardianActionButton(guardianActionLabel(view, action), "guardian.action.${action.wire}", !state.busy &&
                            (action != GuardianParentAction.Request || view.childName != null && view.clubName != null), { onAction(view, action) })
                    }
                }
            }
            Text("Vos demandes", style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
            state.history.error?.let { Text(it, color = Sgm.colors.textPrimary) }
            if (state.history.loaded && state.history.items.isEmpty() && !state.history.hasMore) Text("Aucune demande.", color = Sgm.colors.textSecondary)
            state.history.items.forEach { item ->
                OutlinedButton(onClick = { onHistory(item) }, enabled = !state.busy,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Sgm.colors.textPrimary),
                    modifier = Modifier.fillMaxWidth().testTag("guardian.history.${item.id}")) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(item.childName ?: "Nom de l’enfant indisponible")
                        Text(item.clubName ?: "Nom du club indisponible")
                        Text(item.statusLabel)
                    }
                }
            }
            if (state.history.hasMore) GuardianActionButton("Demandes suivantes", "guardian.history.more", !state.busy, onMoreHistory)
        }
    }
}

@Composable
private fun GuardianSelector(label: String, selected: String?, enabled: Boolean, tag: String, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = Sgm.colors.textSecondary)
        GuardianActionButton(selected ?: "Choisir", tag, enabled, onClick)
    }
}

@Composable
internal fun GuardianActionButton(label: String, tag: String, enabled: Boolean = true, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, enabled = enabled,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Sgm.colors.textPrimary),
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag(tag)) { Text(label) }
}

internal fun guardianActionLabel(view: GuardianVerification, action: GuardianParentAction) = when (action) {
    GuardianParentAction.Request -> if (view.status == null) "Demander la vérification" else "Nouvelle demande"
    GuardianParentAction.Withdraw -> if (view.status == GuardianVerificationStatus.Verified) "Retirer la vérification" else "Retirer la demande"
}
