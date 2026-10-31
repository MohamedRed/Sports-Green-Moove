package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm

@Composable
internal fun GuardianOptionDialog(kind: GuardianOptionKind, page: GuardianPageState<GuardianOption>, selected: String?,
    onChoose: (String) -> Unit, onMore: () -> Unit, onRetry: () -> Unit, onClose: () -> Unit) {
    AlertDialog(onDismissRequest = onClose, containerColor = Sgm.colors.bgCard, titleContentColor = Sgm.colors.textPrimary,
        textContentColor = Sgm.colors.textPrimary, title = { Text(if (kind == GuardianOptionKind.Children) "Choisir un enfant" else "Choisir un club") },
        text = {
            Column(Modifier.fillMaxWidth().heightIn(max = 360.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (page.busy) Text("Chargement...")
                page.error?.let { Text(it); TextButton(onClick = onRetry, enabled = !page.busy) { Text("Actualiser", color = Sgm.colors.textPrimary) } }
                if (page.loaded && page.items.isEmpty() && !page.hasMore) Text(if (kind == GuardianOptionKind.Children) "Aucun enfant disponible." else "Aucun club disponible.")
                page.items.forEach { option ->
                    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("guardian.option.${option.id}")
                        .selectable(selected == option.id, enabled = !page.busy && option.name != null, role = Role.RadioButton,
                            onClick = { onChoose(option.id) })) {
                        RadioButton(selected == option.id, onClick = null, enabled = !page.busy && option.name != null)
                        Text(option.name ?: "Nom indisponible", modifier = Modifier.weight(1f).padding(vertical = 12.dp))
                    }
                }
                if (page.hasMore) TextButton(onClick = onMore, enabled = !page.busy, modifier = Modifier.testTag("guardian.options.more")) {
                    Text(if (kind == GuardianOptionKind.Children) "Autres enfants" else "Autres clubs", color = Sgm.colors.textPrimary)
                }
            }
        }, confirmButton = { TextButton(onClick = onClose) { Text("Fermer", color = Sgm.colors.textPrimary) } })
}

@Composable
internal fun GuardianParentConfirmation(view: GuardianVerification, action: GuardianParentAction, onClose: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(onDismissRequest = onClose, containerColor = Sgm.colors.bgCard, titleContentColor = Sgm.colors.textPrimary,
        textContentColor = Sgm.colors.textPrimary,
        title = { Text(if (action == GuardianParentAction.Request) "Demander la vérification ?" else "${guardianActionLabel(view, action)} ?") },
        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(view.childName ?: "Nom de l’enfant indisponible"); Text(view.clubName ?: "Nom du club indisponible")
        } },
        confirmButton = { TextButton(onClick = onConfirm, modifier = Modifier.testTag("guardian.confirm")) { Text("Confirmer", color = Sgm.colors.textPrimary) } },
        dismissButton = { TextButton(onClick = onClose, modifier = Modifier.testTag("guardian.keep")) { Text("Revenir", color = Sgm.colors.textPrimary) } })
}
